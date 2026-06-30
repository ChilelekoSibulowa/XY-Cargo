export type CmsSiteData = {
  topBar: {
    hours: string;
    email: string;
    address: string;
    phone: string;
    facebookUrl: string;
    instagramUrl: string;
    linkedinUrl: string;
    youtubeUrl: string;
    tiktokUrl: string;
  };
  nav: {
    ctaLabel: string;
  };
  cta: {
    title: string;
    subtitle: string;
    buttonLabel: string;
  };
  footer: {
    about: string;
    columns: {
      title: string;
      items: string[];
    }[];
    supportItems: string[];
    bottomLeft: string;
    bottomRight: string;
  };
};

export type CmsHero = {
  title: string;
  breadcrumb: string;
  image: string;
};

export type CmsAboutData = {
  hero: CmsHero;
  intro: {
    title: string;
    body: string;
    buttonLabel: string;
    image: string;
  };
  visionMission: {
    title: string;
    body: string;
  }[];
  coreValues: {
    title: string;
    body: string;
  }[];
};

export type CmsSupportData = {
  hero: CmsHero;
  intro: {
    title: string;
    body: string;
    email: string;
    address: string;
    phone: string;
    whatsapp: string;
    whatsappUrl?: string;
    liveChat?: string;
    liveChatUrl?: string;
  };
  form: {
    title: string;
    buttonLabel: string;
  };
};

export type CmsFaqData = {
  hero: CmsHero;
  faqs: {
    question: string;
    answer: string;
  }[];
};

export type CmsHowWeWorkData = {
  hero: CmsHero;
  intro: {
    title: string;
    subtitle: string;
  };
  process: {
    title: string;
    body: string;
    buttonLabel: string;
    image: string;
  };
  steps: {
    title: string;
    body: string;
    image: string;
  }[];
  secondaryCta: {
    buttonLabel: string;
  };
};

export type CmsServicesData = {
  hero: CmsHero;
  intro: {
    title: string;
    body: string;
    image: string;
  };
    services: {
      tag: string;
      title: string;
      body: string;
      bullets: string[];
      buttonLabel?: string;
      image: string;
    }[];
  cta: {
    title: string;
    body: string;
    buttonLabel: string;
  };
};

export type CmsHomeData = {
  hero: {
    title: string;
    subtitle: string;
    description?: string;
    buttonPrimary: string;
    buttonSecondary: string;
    image: string;
  };
  heroSlides?: {
    title: string;
    subtitle: string;
    description?: string;
    image: string;
  }[];
  process: {
    title: string;
    body: string;
    buttonLabel: string;
    image: string;
  };
  steps: {
    title: string;
    body: string;
    image: string;
  }[];
  about: {
    title: string;
    body: string;
    accordions: { title: string; body: string }[];
    image: string;
  };
  stats: { label: string; value: string }[];
  airServices: { title: string; body: string }[];
  seaServices: { title: string; body: string }[];
  video: {
    title: string;
    image: string;
  };
  calculator: {
    title: string;
    subtitle: string;
    tabs: string[];
    bullets: string[];
  };
  infoSection: {
    minimumRequirements: string[];
    storagePolicy: string[];
    includeCard: {
      title: string;
      subheading: string;
      items: string[];
      image: string;
    };
  };
  airRates: {
    location: string;
    cards: {
      title: string;
      price: string;
      description: string;
    }[];
  }[];
  seaRates: {
    location: string;
    cards: {
      title: string;
      price: string;
      description: string;
      notes?: string[];
    }[];
  }[];
};

export type CmsSimplePage = {
  hero: CmsHero;
  body: string;
};

export type CmsBlogPost = {
  title: string;
  body: string;
  featuredImage: string;
  publishedAt: string;
};

export type CmsBlogData = {
  hero: CmsHero;
  intro: {
    title: string;
    body: string;
  };
  posts: CmsBlogPost[];
};

export type CmsPodcastEpisode = {
  title: string;
  description: string;
  youtubeUrl: string;
  publishedAt: string;
};

export type CmsPodcastData = {
  hero: CmsHero;
  intro: {
    title: string;
    body: string;
  };
  episodes: CmsPodcastEpisode[];
};

export type CmsGalleryItem = {
  title: string;
  caption: string;
  image: string;
};

export type CmsGalleryData = {
  hero: CmsHero;
  intro: {
    title: string;
    body: string;
  };
  items: CmsGalleryItem[];
};

const heroImage = "/hero/section-hero.jpg";

export const cmsDefaults = {
  site: {
    topBar: {
      hours: "8:00am-5:00pm (Zambia Time)",
      email: "info@xycargozm.com",
      address: "Shop #94 Carousel Mall, Lusaka, Zambia",
      phone: "+260 211220012",
      facebookUrl: "https://www.facebook.com/share/1AwnHQ7TFp/?mibextid=wwXIfr",
      instagramUrl: "https://www.instagram.com/xy_cargo_zm?igsh=MWVoNHowcDFjMHY3ag==",
      linkedinUrl: "https://www.linkedin.com/company/110032921/admin/dashboard/",
      youtubeUrl: "https://www.youtube.com/@XYCARGOZM",
      tiktokUrl: "https://www.tiktok.com/@xy.cargo.zm",
    },
    nav: {
      ctaLabel: "Sign In/Sign Up",
    },
    cta: {
      title: "Support Center",
      subtitle: "Get help when you need it. Our expert support team is here 24/7 to assist you with any questions or concerns.",
      buttonLabel: "Get In Touch",
    },
    footer: {
      about:
        "Reliable China to Zambia shipping services. Specializing in air and sea freight with competitive rates for all types of goods.",
      columns: [
        {
          title: "Useful Links",
          items: ["Sign In", "Shipping Calculator", "Package Tracking", "Services", "Contact Us", "FAQs", "About Us"],
        },
        {
          title: "Services",
          items: [
            "Air Freight",
            "Sea Freight",
            "Product Sourcing",
            "Supplier Payment Facilitation",
            "Custom Clearance",
            "Door To Door Delivery",
            "Export",
          ],
        },
      ],
      supportItems: [
        "Support Centre: Call: +260 211220012",
        "WhatsApp: +260 967379139 / +260 769481203",
        "Live Chat: chat with us at xycargozm.com",
        "Get in touch with us: info@xycargozm.com",
        "Address: Shop #94 Carousel Mall, Lusaka, Zambia",
      ],
      bottomLeft:
        "(c) 2026 XY Cargo Zambia. All Rights Reserved. China to Zambia Shipping Specialists - Designed by",
      bottomRight: "Privacy Policy  /  Terms & Conditions",
    },
  } satisfies CmsSiteData,
  home: {
    hero: {
      title: "China to Zambia Shipping",
      subtitle: "Fast, Reliable & Affordable",
      description:
        "Reliable air and sea freight from China to Zambia with competitive rates and transparent pricing. Your trusted logistics partner connecting two nations.",
      buttonPrimary: "Track Shipment",
      buttonSecondary: "Get A Quote",
      image:
        "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?q=80&w=1920&auto=format&fit=crop",
    },
    heroSlides: [
      {
        title: "China to Zambia Shipping",
        subtitle: "Fast, Reliable & Affordable",
        description:
          "Reliable air and sea freight from China to Zambia with competitive rates and transparent pricing. Your trusted logistics partner connecting two nations.",
      image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=1920&auto=format&fit=crop",
      },
      {
        title: "China to Zambia Shipping",
        subtitle: "Fast, Reliable & Affordable",
        description:
          "Reliable air and sea freight from China to Zambia with competitive rates and transparent pricing. Your trusted logistics partner connecting two nations.",
        image: "https://images.unsplash.com/photo-1540962351504-03099e0a754b?q=80&w=1920&auto=format&fit=crop",
      },
      {
        title: "China to Zambia Shipping",
        subtitle: "Fast, Reliable & Affordable",
        description:
          "Reliable air and sea freight from China to Zambia with competitive rates and transparent pricing. Your trusted logistics partner connecting two nations.",
        image: "https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?q=80&w=1920&auto=format&fit=crop",
      },
    ],
    process: {
      title: "Our Shipping Process",
      body:
        "We make international shipping simple, transparent, and reliable. From registration to delivery, we keep you informed every step of the way. Our advanced tracking system allows you to monitor your package in real-time.",
      buttonLabel: "Track Your Package",
      image: "/steps/process.jpg",
    },
    steps: [
      {
        title: "Register",
        body: "Create your account and verify your identity for secure shipping services.",
        image: "/steps/step-1.png",
      },
      {
        title: "Drop/Send Parcel",
        body: "Send your parcel to our warehouse for processing and shipping.",
        image: "/steps/step-2.png",
      },
      {
        title: "Ship & Track",
        body: "Watch your package journey in real-time with our advanced tracking system.",
        image: "/steps/step-3.png",
      },
      {
        title: "Receive",
        body: "Your recipient gets the package safely delivered to their doorstep.",
        image: "/steps/step-4.png",
      },
    ],
    about: {
      title: "About XY Cargo Zambia",
      body:
        "Your trusted partner in international shipping, connecting China and Zambia with reliable, efficient, and secure logistics solutions.",
      accordions: [
        {
          title: "Why Choose Us?",
          body:
            "With over 5 years of experience in international logistics, XY Cargo Zambia has established itself as the leading shipping company connecting China and Zambia. We specialize in air freight, sea freight, and express shipping services, ensuring your packages arrive safely and on time. From small parcels to large cargo shipments, we handle it all with the same level of care and professionalism that has made us Zambia's most trusted shipping partner.",
        },
        {
          title: "Our Mission",
          body:
            "Our mission is to simplify global and regional trade for our clients through timely deliveries, transparent operations, and cost-effective logistics services. We aim to be the preferred link between China and Zambia, ensuring smooth cargo movement with integrity and professionalism.",
        },
        {
          title: "Our Vision",
          body:
            "To redefine logistics in Africa by building a connected, efficient, and technology-driven cargo network that empowers trade and supports economic growth.",
        },
      ],
      image: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=1200&auto=format&fit=crop",
    },
    stats: [
      { label: "Countries served", value: "200+" },
      { label: "Packages Delivered", value: "1M+" },
      { label: "Customer Support", value: "24/7" },
    ],
    airServices: [
      { title: "Fastest Delivery", body: "Express air freight solutions with tight ETAs." },
      { title: "Real-time Tracking", body: "Monitor shipments from departure to arrival." },
      { title: "Priority Handling", body: "Dedicated handling for high-value cargo." },
      { title: "Daily Consolidation", body: "Frequent flights for steady flow." },
      { title: "Flexible Pickup", body: "Pickups scheduled to match your workflow." },
      { title: "Cargo Insurance", body: "Optional coverage for additional peace of mind." },
    ],
    seaServices: [
      { title: "Cost-effective Shipping", body: "Optimized sea routes for bulk cargo." },
      { title: "Container Consolidation", body: "Share containers and reduce costs." },
      { title: "Customs Coordination", body: "Clearance support and documentation." },
      { title: "Door-to-door Delivery", body: "Last-mile delivery across Zambia." },
      { title: "Scheduled Sailings", body: "Reliable departures and arrivals." },
      { title: "Warehouse Storage", body: "Secure storage before final dispatch." },
    ],
    video: {
      title: "Watch Our Latest Updates",
      image: "/videos/xy-cargo-home.mp4",
    },
    calculator: {
      title: "China to Zambia Shipping Calculator",
      subtitle: "Get instant quotes for your shipments from China to Zambia.",
      tabs: ["Air Freight", "Sea Freight", "Door to Door"],
      bullets: [
        "Rates by weight and volume",
        "Clear delivery timelines",
        "Flexible payment options",
        "Insurance and inspection add-ons",
      ],
    },
    infoSection: {
      minimumRequirements: [
        "Air freight: Minimum 1kg",
        "Sea freight: Minimum 0.1 CBM",
        "Sea freight starting price: $50",
      ],
      storagePolicy: [
        "First 3 days: FREE storage",
        "After 3 days: $2 per day charge",
        "Unclaimed packages subject to fees",
      ],
      includeCard: {
        title: "Every Shipment Includes",
        subheading: "Real-time tracking included - WhatsApp support available",
        items: [
          "China warehouse handling",
          "Minimum 1kg for air freight",
          "Minimum 0.1 CBM for sea freight",
          "Unclaimed package storage (3 days free)",
        ],
        image:
          "/info/shipment-includes.jpg",
      },
    },
    airRates: [
      {
        location: "Lusaka",
        cards: [
          {
            title: "Normal Goods",
            price: "$13 per kg (10-17 days)",
            description: "General merchandise, clothing, accessories",
          },
          {
            title: "Wigs & Hair Products",
            price: "$15 per kg (10-17 days)",
            description: "Hair extensions, wigs, styling products",
          },
          {
            title: "Mobile Phones",
            price: "$16 per kg (10-17 days)",
            description: "Smartphones",
          },
          {
            title: "Battery Goods & Electronics",
            price: "$14 per kg (10-17 days)",
            description: "Items with batteries, TVs, Speakers, Monitors",
          },
          {
            title: "Laptops & iPads",
            price: "$16 per kg (10-17 days)",
            description: "Computers, laptops, tablet devices",
          },
          {
            title: "Medicare",
            price: "$16 per kg (10-17 days)",
            description: "Cosmetics and medicine",
          },
        ],
      },
      {
        location: "Ndola/Kitwe",
        cards: [
          {
            title: "Normal Goods",
            price: "$15 per kg (10-17 days)",
            description: "General merchandise, clothing, accessories",
          },
          {
            title: "Wigs & Hair Products",
            price: "$17 per kg (10-17 days)",
            description: "Hair extensions, wigs, styling products",
          },
          {
            title: "Mobile Phones",
            price: "$18 per kg (10-17 days)",
            description: "Smartphones",
          },
          {
            title: "Battery Goods & Electronics",
            price: "$16 per kg (10-17 days)",
            description: "Items with batteries, TVs, Speakers, Monitors",
          },
          {
            title: "Laptops & iPads",
            price: "$18 per kg (10-17 days)",
            description: "Computers, laptops, tablet devices",
          },
          {
            title: "Medicare",
            price: "$18 per kg (10-17 days)",
            description: "Cosmetics and medicine",
          },
        ],
      },
    ],
    seaRates: [
      {
        location: "Lusaka",
        cards: [
          {
            title: "General Goods",
            price: "$300 per CBM",
            description: "Clothing, bags, shoes, accessories, fabrics, machinery",
            notes: ["Minimum Charge: $50 (0.1 CBM minimum)"],
          },
          {
            title: "Special Goods",
            price: "$330 per CBM",
            description: "Built-in batteries, printing materials, food items",
            notes: [
              "Minimum Charge: $50 (0.1 CBM minimum)",
              "Requires detailed communication before shipping",
            ],
          },
        ],
      },
      {
        location: "Ndola/Kitwe",
        cards: [
          {
            title: "General Goods",
            price: "$330 per CBM",
            description: "Clothing, bags, shoes, accessories, fabrics, machinery",
            notes: ["Minimum Charge: $50 (0.1 CBM minimum)"],
          },
          {
            title: "Special Goods",
            price: "$360 per CBM",
            description: "Built-in batteries, printing materials, food items",
            notes: [
              "Minimum Charge: $50 (0.1 CBM minimum)",
              "Requires detailed communication before shipping",
            ],
          },
        ],
      },
    ],
  } satisfies CmsHomeData,
  services: {
    hero: {
      title: "Support Center",
      breadcrumb: "XY Cargo Zambia / Services",
      image: heroImage,
    },
    intro: {
      title: "Our Premium Shipping Services",
      body:
        "Reliable, fast, and secure shipping solutions connecting China and Zambia with services tailored to your specific cargo needs.\n\nComprehensive Logistics Solutions\nFrom air freight to sea shipping, we provide end-to-end logistics services designed to meet your specific shipping requirements. Our experienced team ensures your cargo arrives safely and on time.\n\nWhether you're shipping electronics, textiles, machinery, or consumer goods, we have the expertise and infrastructure to handle it all with the highest standards of safety and efficiency.",
      image:
        "https://images.unsplash.com/photo-1529070538774-1843cb3265df?q=80&w=1200&auto=format&fit=crop",
    },
    services: [
      {
        tag: "01",
        title: "Air Freight Transport",
        body:
          "Fast and reliable shipping from China to Zambia in just 10-17 days. Perfect for time-sensitive shipments and valuable goods.",
        bullets: ["Door-to-door service", "Real-time tracking", "Customs clearance included"],
        buttonLabel: "Get Air Freight Quote",
        image: "/services/service-01.jpg",
      },
      {
        tag: "02",
        title: "Sea Freight",
        body:
          "Cost-effective solution for bulk shipments with transit times of 40-60 days. Ideal for large volumes and non-urgent cargo.",
        bullets: ["Affordable bulk rates", "FCL & LCL options", "Regular scheduled departures"],
        buttonLabel: "Calculate Sea Freight",
        image: "/services/service-02.jpg",
      },
      {
        tag: "03",
        title: "Product Sourcing",
        body:
          "Expert assistance in finding and selecting the best products from Chinese suppliers. We help you discover quality products at competitive prices.",
        bullets: ["Supplier verification", "Product research", "Quality assurance", "Price negotiation"],
        buttonLabel: "Start Product Sourcing",
        image: "/services/service-03.jpg",
      },
      {
        tag: "04",
        title: "Supplier Payment Facilitation",
        body:
          "Secure and convenient payment solutions for Chinese suppliers. We handle currency exchange, payment processing, and financial security.",
        bullets: ["Secure payment processing", "Currency exchange", "Payment protection", "Transaction monitoring"],
        buttonLabel: "Learn About Payments",
        image: "/services/service-04.jpg",
      },
      {
        tag: "05",
        title: "Custom Clearance",
        body:
          "Hassle-free import processing with our experienced team handling all documentation and regulatory requirements.",
        bullets: ["Documentation assistance", "Duty & tax calculation", "Compliance management"],
        buttonLabel: "Customs Clearance Info",
        image: "/services/service-05.jpg",
      },
      {
        tag: "06",
        title: "Door To Door Delivery",
        body:
          "Complete end-to-end delivery service from supplier warehouse to your doorstep in Zambia. We handle every step of the logistics chain.",
        bullets: ["Full logistics management", "Real-time tracking", "Insurance coverage", "Final delivery"],
        buttonLabel: "Schedule Delivery",
        image: "/services/service-06.jpg",
      },
      {
        tag: "07",
        title: "Export",
        body:
          "Professional export services for businesses shipping goods internationally. We ensure compliance with all export regulations and requirements.",
        bullets: ["Export documentation", "Regulatory compliance", "Customs procedures", "International shipping"],
        buttonLabel: "Export",
        image: "/services/service-07.jpg",
      },
    ],
    cta: {
      title: "Need a Custom Shipping Solution?",
      body:
        "Get help when you need it. Our expert support team is here 24/7 to assist you with any questions or concerns.",
      buttonLabel: "Get a Quote",
    },
  } satisfies CmsServicesData,
  "how-we-work": {
    hero: {
      title: "How We Work",
      breadcrumb: "XY Cargo Zambia / How We Work",
      image: heroImage,
    },
    intro: {
      title: "How We Work",
      subtitle: "Simple, transparent, and reliable. Our streamlined process ensures your packages reach their destination safely and on time.",
    },
    process: {
      title: "Our Shipping Process",
      body:
        "We've simplified the shipping process into four easy steps to ensure transparency and reliability. From registration to delivery, we keep you informed every step of the way.\n\nOur advanced tracking system allows you to monitor your package in real-time, giving you peace of mind throughout the entire shipping journey.",
      buttonLabel: "Track Your Package",
      image: "/steps/process.jpg",
    },
    steps: [
      {
        title: "Register",
        body: "Create your account and verify your identity for secure shipping services.",
        image: "/steps/step-1.png",
      },
      {
        title: "Drop/Send Parcel",
        body: "Send your parcel to our warehouse for processing and shipping.",
        image: "/steps/step-2.png",
      },
      {
        title: "Ship & Track",
        body: "Watch your package journey in real-time with our advanced tracking system.",
        image: "/steps/step-3.png",
      },
      {
        title: "Receive",
        body: "Your recipient gets the package safely delivered to their doorstep.",
        image: "/steps/step-4.png",
      },
    ],
    secondaryCta: {
      buttonLabel: "Start Shipping",
    },
  } satisfies CmsHowWeWorkData,
  faq: {
    hero: {
      title: "Faq",
      breadcrumb: "XY Cargo Zambia / Faq",
      image: heroImage,
    },
    faqs: [
      {
        question: "What is XY Cargo Zambia?",
        answer:
          "XY Cargo Zambia is a leading logistics and cargo transportation company in Zambia, providing comprehensive shipping solutions for individuals and businesses across the country and internationally.",
      },
      {
        question: "What services do you offer?",
        answer: "We offer air freight, sea freight, product sourcing, customs clearance, and door to door delivery.",
      },
      {
        question: "How do I get started?",
        answer: "Create an account, submit your shipment details, and our team will guide you through the process.",
      },
      {
        question: "How can I track my package?",
        answer: "Use the tracking number provided after pickup to follow your shipment in real time.",
      },
      {
        question: "What if my package is delayed?",
        answer: "Our support team will notify you and provide updated delivery estimates.",
      },
      {
        question: "Can I change the delivery address after shipping?",
        answer: "Yes, contact support immediately to update delivery details before final dispatch.",
      },
      {
        question: "What items cannot be shipped?",
        answer: "Restricted items include hazardous materials, illegal goods, and items prohibited by customs.",
      },
      {
        question: "How do I contact customer support?",
        answer:
          "You can reach us by phone, email, WhatsApp, or live chat. Visit the Support page for the latest contact details.",
      },
      {
        question: "Do you offer WhatsApp or live chat support?",
        answer:
          "Yes. We provide WhatsApp support and live chat for quick questions and shipment updates. Check the Support page for the current links.",
      },
      {
        question: "How do I report a problem parcel?",
        answer:
          "Use the Support portal to submit a problem parcel report so our team can investigate and update you.",
      },
      {
        question: "How do I submit a claim?",
        answer:
          "Claims can be submitted via the Support portal. Include your shipment code and supporting documents for faster processing.",
      },
    ],
  } satisfies CmsFaqData,
  support: {
    hero: {
      title: "Support",
      breadcrumb: "XY Cargo Zambia / Support",
      image: heroImage,
    },
    intro: {
      title: "Customer Support Center",
      body:
        "Get help when you need it. Our expert support team is here to assist you with any questions or concerns about your shipments.",
      email: "info@xycargozm.com",
      address: "Shop #94 Carousel Mall, Lusaka, Zambia",
      phone: "Call : +260 211220012",
      whatsapp: "WhatsApp: +260 967379139 / +260 769481203",
      whatsappUrl: "https://wa.me/260967379139",
      liveChat: "Live Chat: chat with us at xycargozm.com",
      liveChatUrl: "https://embed.tawk.to/69d2d838eece5f1c34664134/1jlfpp8ge",
    },
    form: {
      title: "Send A Message",
      buttonLabel: "Submit Form",
    },
  } satisfies CmsSupportData,
  about: {
    hero: {
      title: "About Us",
      breadcrumb: "XY Cargo Zambia / About Us",
      image: heroImage,
    },
    intro: {
      title: "About XY Cargo Zambia",
      body:
        "XY Cargo Zambia is your trusted logistics partner for shipping goods from China to Zambia. We offer reliable, affordable, and fast air and sea freight services, with a commitment to customer satisfaction and transparency.\n\nComprehensive Logistics Solutions\nFrom air freight to sea shipping, we provide end-to-end logistics services designed to meet your specific shipping requirements. Our experienced team ensures your cargo arrives safely and on time.\n\nWhether you're shipping electronics, textiles, machinery, or consumer goods, we have the expertise and infrastructure to handle it all with the highest standards of safety and efficiency.",
      buttonLabel: "Track Your Package",
      image: "/hero/about-section.jpg",
    },
    visionMission: [
      {
        title: "Our Vision",
        body:
          "To redefine logistics in Africa by building a connected, efficient, and technology-driven cargo network that empowers trade and supports economic growth.",
      },
      {
        title: "Our Mission",
        body:
          "Our mission is to simplify global and regional trade for our clients through timely deliveries, transparent operations, and cost-effective logistics services. We aim to be the preferred link between China and Zambia, ensuring smooth cargo movement with integrity and professionalism.",
      },
    ],
    coreValues: [
      {
        title: "Reliability",
        body: "We keep our promises by ensuring every shipment is handled with care, accuracy, and timeliness.",
      },
      {
        title: "Integrity",
        body: "We conduct our business with honesty, transparency, and accountability in every transaction and partnership.",
      },
      {
        title: "Customer Commitment",
        body: "Our customers are at the heart of what we do; we go the extra mile to provide exceptional service and lasting satisfaction.",
      },
      {
        title: "Innovation",
        body: "We embrace creativity and technology to improve our logistics processes and deliver smarter, faster solutions.",
      },
      {
        title: "Teamwork",
        body: "We believe in the power of collaboration - working together with our clients, partners, and staff to achieve shared success.",
      },
      {
        title: "Efficiency",
        body: "We strive to deliver smart, seamless, and cost-effective logistics solutions through innovation and continuous improvement.",
      },
    ],
  } satisfies CmsAboutData,
  gallery: {
    hero: {
      title: "Gallery",
      breadcrumb: "XY Cargo Zambia / Gallery",
      image: heroImage,
    },
    intro: {
      title: "Inside Our Freight Journey",
      body:
        "Upload warehouse images, delivery highlights, team moments, and shipment snapshots here. Every image added in admin will appear live on the gallery page.",
    },
    items: [],
  } satisfies CmsGalleryData,
  podcast: {
    hero: {
      title: "Podcast",
      breadcrumb: "XY Cargo Zambia / Podcast",
      image: heroImage,
    },
    intro: {
      title: "Podcast Episodes",
      body:
        "Publish podcast episodes here using YouTube links. Each episode can have its own title, description, and embedded player on the live site.",
    },
    episodes: [],
  } satisfies CmsPodcastData,
  blog: {
    hero: {
      title: "Blog",
      breadcrumb: "XY Cargo Zambia / Blog",
      image: heroImage,
    },
    intro: {
      title: "Latest Stories",
      body:
        "Create blog articles with a featured image, title, and full story body. Published blog posts will appear here in the order you arrange them in admin.",
    },
    posts: [],
  } satisfies CmsBlogData,
};
