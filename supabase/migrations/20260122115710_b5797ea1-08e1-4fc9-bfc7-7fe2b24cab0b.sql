-- Create app_role enum for role-based access control
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'customer', 'driver', 'branch_manager');

-- Create shipment_status enum
CREATE TYPE public.shipment_status AS ENUM ('saved_pickup', 'saved_dropoff', 'requested_pickup', 'approved', 'assigned', 'received', 'delivered', 'supplied', 'returned', 'returned_stock', 'returned_delivered', 'closed');

-- Create mission_status enum
CREATE TYPE public.mission_status AS ENUM ('requested', 'assigned', 'approved', 'received', 'done', 'closed');

-- Create mission_type enum
CREATE TYPE public.mission_type AS ENUM ('pickup', 'delivery', 'transfer', 'supply');

-- Create service_type enum
CREATE TYPE public.service_type AS ENUM ('air', 'sea');

-- Create payment_method enum
CREATE TYPE public.payment_method AS ENUM ('cash', 'wallet', 'bank_transfer', 'mobile_money');

-- Create transaction_type enum
CREATE TYPE public.transaction_type AS ENUM ('payment', 'refund', 'wallet_topup', 'wallet_deduction');

-- Profiles table for user information
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (user_id, role)
);

-- Branches table
CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    country TEXT,
    phone TEXT,
    email TEXT,
    manager_id UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Covered places / Areas
CREATE TABLE public.covered_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    city TEXT NOT NULL,
    zone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Customers table (can be linked to auth users or standalone)
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    address TEXT,
    city TEXT,
    country TEXT,
    branch_id UUID REFERENCES public.branches(id),
    wallet_balance DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Drivers table
CREATE TABLE public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    license_number TEXT,
    vehicle_type TEXT,
    vehicle_plate TEXT,
    branch_id UUID REFERENCES public.branches(id),
    wallet_balance DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Receivers table
CREATE TABLE public.receivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    address TEXT,
    city TEXT,
    country TEXT,
    customer_id UUID REFERENCES public.customers(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Shipping rates table
CREATE TABLE public.shipping_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    service_type service_type NOT NULL,
    origin_area_id UUID REFERENCES public.covered_areas(id),
    destination_area_id UUID REFERENCES public.covered_areas(id),
    rate_per_kg DECIMAL(10,2),
    rate_per_cbm DECIMAL(10,2),
    minimum_charge DECIMAL(10,2) DEFAULT 50,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Packages/Package types
CREATE TABLE public.package_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    max_weight DECIMAL(10,2),
    max_length DECIMAL(10,2),
    max_width DECIMAL(10,2),
    max_height DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Currencies
CREATE TABLE public.currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    exchange_rate DECIMAL(15,6) DEFAULT 1,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Shipments table
CREATE TABLE public.shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) NOT NULL,
    receiver_id UUID REFERENCES public.receivers(id) NOT NULL,
    branch_id UUID REFERENCES public.branches(id) NOT NULL,
    destination_branch_id UUID REFERENCES public.branches(id),
    service_type service_type NOT NULL DEFAULT 'air',
    status shipment_status NOT NULL DEFAULT 'saved_pickup',
    
    -- Package details
    description TEXT,
    weight DECIMAL(10,2) NOT NULL DEFAULT 0,
    length DECIMAL(10,2) DEFAULT 0,
    width DECIMAL(10,2) DEFAULT 0,
    height DECIMAL(10,2) DEFAULT 0,
    cbm DECIMAL(10,4) GENERATED ALWAYS AS (
        CASE WHEN length > 0 AND width > 0 AND height > 0 
        THEN (length * width * height) / 1000000.0 
        ELSE 0 END
    ) STORED,
    quantity INTEGER DEFAULT 1,
    
    -- Pricing
    shipping_rate_id UUID REFERENCES public.shipping_rates(id),
    shipping_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    additional_charges DECIMAL(15,2) DEFAULT 0,
    discount DECIMAL(15,2) DEFAULT 0,
    total_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    currency_id UUID REFERENCES public.currencies(id),
    
    -- Payment
    payment_method payment_method,
    payment_status TEXT DEFAULT 'pending',
    paid_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Tracking
    pickup_date TIMESTAMP WITH TIME ZONE,
    estimated_delivery_date TIMESTAMP WITH TIME ZONE,
    actual_delivery_date TIMESTAMP WITH TIME ZONE,
    
    -- Assignment
    assigned_driver_id UUID REFERENCES public.drivers(id),
    
    -- Notes
    notes TEXT,
    internal_notes TEXT,
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Missions table
CREATE TABLE public.missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    mission_type mission_type NOT NULL,
    status mission_status NOT NULL DEFAULT 'requested',
    driver_id UUID REFERENCES public.drivers(id),
    branch_id UUID REFERENCES public.branches(id) NOT NULL,
    destination_branch_id UUID REFERENCES public.branches(id),
    scheduled_date TIMESTAMP WITH TIME ZONE,
    completed_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Mission shipments (many-to-many)
CREATE TABLE public.mission_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(mission_id, shipment_id)
);

-- Transactions table
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    transaction_type transaction_type NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency_id UUID REFERENCES public.currencies(id),
    payment_method payment_method,
    
    -- References
    customer_id UUID REFERENCES public.customers(id),
    driver_id UUID REFERENCES public.drivers(id),
    shipment_id UUID REFERENCES public.shipments(id),
    branch_id UUID REFERENCES public.branches(id),
    
    status TEXT DEFAULT 'completed',
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Delivery time settings
CREATE TABLE public.delivery_times (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    min_days INTEGER NOT NULL,
    max_days INTEGER NOT NULL,
    service_type service_type,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- System settings
CREATE TABLE public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'string',
    category TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Notifications
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    notification_type TEXT,
    reference_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Manifests
CREATE TABLE public.manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    origin_branch_id UUID REFERENCES public.branches(id) NOT NULL,
    destination_branch_id UUID REFERENCES public.branches(id) NOT NULL,
    driver_id UUID REFERENCES public.drivers(id),
    status TEXT DEFAULT 'pending',
    departure_date TIMESTAMP WITH TIME ZONE,
    arrival_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Manifest shipments
CREATE TABLE public.manifest_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_id UUID REFERENCES public.manifests(id) ON DELETE CASCADE NOT NULL,
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(manifest_id, shipment_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.covered_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manifest_shipments ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin or staff
CREATE OR REPLACE FUNCTION public.is_admin_or_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'staff', 'branch_manager')
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin/Staff can view all profiles" ON public.profiles
    FOR SELECT USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage all profiles" ON public.profiles
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles (only admin can manage)
CREATE POLICY "Admin can manage roles" ON public.user_roles
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for branches
CREATE POLICY "Anyone authenticated can view active branches" ON public.branches
    FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admin/Staff can manage branches" ON public.branches
    FOR ALL USING (public.is_admin_or_staff(auth.uid()));

-- RLS Policies for covered_areas
CREATE POLICY "Anyone authenticated can view areas" ON public.covered_areas
    FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admin/Staff can manage areas" ON public.covered_areas
    FOR ALL USING (public.is_admin_or_staff(auth.uid()));

-- RLS Policies for customers
CREATE POLICY "Customers can view their own data" ON public.customers
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admin/Staff can manage customers" ON public.customers
    FOR ALL USING (public.is_admin_or_staff(auth.uid()));

-- RLS Policies for drivers
CREATE POLICY "Drivers can view their own data" ON public.drivers
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admin/Staff can manage drivers" ON public.drivers
    FOR ALL USING (public.is_admin_or_staff(auth.uid()));

-- RLS Policies for receivers
CREATE POLICY "Admin/Staff can manage receivers" ON public.receivers
    FOR ALL USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Customers can view their receivers" ON public.receivers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.customers c 
            WHERE c.id = customer_id AND c.user_id = auth.uid()
        )
    );

-- RLS Policies for shipping_rates
CREATE POLICY "Anyone authenticated can view rates" ON public.shipping_rates
    FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admin can manage rates" ON public.shipping_rates
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for package_types
CREATE POLICY "Anyone authenticated can view package types" ON public.package_types
    FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admin can manage package types" ON public.package_types
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for currencies
CREATE POLICY "Anyone authenticated can view currencies" ON public.currencies
    FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admin can manage currencies" ON public.currencies
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for shipments
CREATE POLICY "Admin/Staff can manage shipments" ON public.shipments
    FOR ALL USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Customers can view their shipments" ON public.shipments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.customers c 
            WHERE c.id = customer_id AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Drivers can view assigned shipments" ON public.shipments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.drivers d 
            WHERE d.id = assigned_driver_id AND d.user_id = auth.uid()
        )
    );

-- RLS Policies for missions
CREATE POLICY "Admin/Staff can manage missions" ON public.missions
    FOR ALL USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Drivers can view their missions" ON public.missions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.drivers d 
            WHERE d.id = driver_id AND d.user_id = auth.uid()
        )
    );

-- RLS Policies for mission_shipments
CREATE POLICY "Admin/Staff can manage mission_shipments" ON public.mission_shipments
    FOR ALL USING (public.is_admin_or_staff(auth.uid()));

-- RLS Policies for transactions
CREATE POLICY "Admin/Staff can manage transactions" ON public.transactions
    FOR ALL USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Customers can view their transactions" ON public.transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.customers c 
            WHERE c.id = customer_id AND c.user_id = auth.uid()
        )
    );

-- RLS Policies for delivery_times
CREATE POLICY "Anyone authenticated can view delivery times" ON public.delivery_times
    FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admin can manage delivery times" ON public.delivery_times
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for system_settings
CREATE POLICY "Admin can manage settings" ON public.system_settings
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone authenticated can view settings" ON public.system_settings
    FOR SELECT TO authenticated USING (true);

-- RLS Policies for notifications
CREATE POLICY "Users can view their notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their notifications" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admin/Staff can manage notifications" ON public.notifications
    FOR ALL USING (public.is_admin_or_staff(auth.uid()));

-- RLS Policies for manifests
CREATE POLICY "Admin/Staff can manage manifests" ON public.manifests
    FOR ALL USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Drivers can view their manifests" ON public.manifests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.drivers d 
            WHERE d.id = driver_id AND d.user_id = auth.uid()
        )
    );

-- RLS Policies for manifest_shipments
CREATE POLICY "Admin/Staff can manage manifest_shipments" ON public.manifest_shipments
    FOR ALL USING (public.is_admin_or_staff(auth.uid()));

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email
    );
    
    -- Default role is customer
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'customer');
    
    RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to generate unique codes
CREATE OR REPLACE FUNCTION public.generate_code(prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    new_code TEXT;
BEGIN
    new_code := prefix || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
    RETURN new_code;
END;
$$;

-- Function to calculate shipping cost
CREATE OR REPLACE FUNCTION public.calculate_shipping_cost(
    p_service_type service_type,
    p_weight DECIMAL,
    p_length DECIMAL,
    p_width DECIMAL,
    p_height DECIMAL,
    p_rate_per_kg DECIMAL,
    p_rate_per_cbm DECIMAL,
    p_minimum_charge DECIMAL DEFAULT 50
)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
DECLARE
    v_cbm DECIMAL;
    v_billable_cbm DECIMAL;
    v_cost DECIMAL;
BEGIN
    IF p_service_type = 'air' THEN
        v_cost := p_weight * COALESCE(p_rate_per_kg, 0);
    ELSE -- sea
        v_cbm := (p_length * p_width * p_height) / 1000000.0;
        v_billable_cbm := GREATEST(v_cbm, 0.1);
        v_cost := GREATEST(v_billable_cbm * COALESCE(p_rate_per_cbm, 0), COALESCE(p_minimum_charge, 50));
    END IF;
    
    RETURN v_cost;
END;
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shipping_rates_updated_at BEFORE UPDATE ON public.shipping_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_missions_updated_at BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_manifests_updated_at BEFORE UPDATE ON public.manifests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default currency
INSERT INTO public.currencies (code, name, symbol, is_default) VALUES ('ZMW', 'Zambian Kwacha', 'K', true);
INSERT INTO public.currencies (code, name, symbol, exchange_rate) VALUES ('USD', 'US Dollar', '$', 0.038);

-- Insert default system settings
INSERT INTO public.system_settings (setting_key, setting_value, category, description) VALUES
('company_name', 'Xy Cargo Zambia', 'general', 'Company name'),
('company_email', 'info@xycargo.com', 'general', 'Company email'),
('company_phone', '+260 XXX XXX XXX', 'general', 'Company phone'),
('default_currency', 'ZMW', 'general', 'Default currency code'),
('auto_generate_codes', 'true', 'shipments', 'Auto generate shipment codes'),
('require_payment_before_delivery', 'true', 'payments', 'Require payment before delivery');

-- Insert default package types
INSERT INTO public.package_types (name, description, max_weight) VALUES
('Document', 'Documents and papers', 2),
('Small Box', 'Small packages up to 5kg', 5),
('Medium Box', 'Medium packages up to 20kg', 20),
('Large Box', 'Large packages up to 50kg', 50),
('Oversized', 'Oversized items', 100);

-- Insert default delivery times
INSERT INTO public.delivery_times (name, min_days, max_days, service_type) VALUES
('Air Express', 1, 3, 'air'),
('Air Standard', 3, 7, 'air'),
('Sea Freight', 14, 30, 'sea'),
('Sea Economy', 30, 45, 'sea');