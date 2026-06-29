import { useState, type FormEvent } from 'react';
import { CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { getAttributionData, trackMetaEvent } from '@/lib/metaPixel';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const NewsletterCta = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const insertSubscriberWithFallback = async (normalizedEmail: string, attribution: ReturnType<typeof getAttributionData>) => {
    const fullInsert = await supabase
      .from('marketing_email_subscribers')
      .insert({
        email: normalizedEmail,
        subscribed_at: new Date().toISOString(),
        subscription_source: 'homepage_newsletter',
        is_active: true,
        marketing_consent: true,
        fbp: attribution.fbp,
        fbc: attribution.fbc,
        fbclid: attribution.fbclid,
        utm_source: attribution.utm_source,
        utm_medium: attribution.utm_medium,
        utm_campaign: attribution.utm_campaign,
        utm_term: attribution.utm_term,
        utm_content: attribution.utm_content,
        page_url: attribution.page_url,
        page_path: attribution.page_path,
        referrer: attribution.referrer,
        metadata: attribution,
      });

    if (!fullInsert.error) {
      return fullInsert;
    }

    const code = (fullInsert.error as { code?: string }).code || '';
    const message = (fullInsert.error as { message?: string }).message || '';
    const shouldFallback =
      code === '42703' ||
      code === '42P01' ||
      code === '42501' ||
      /column|schema cache|does not exist|permission|row-level security|rls/i.test(message);

    if (!shouldFallback) {
      return fullInsert;
    }

    const minimalInsert = await supabase
      .from('marketing_email_subscribers')
      .insert({
        email: normalizedEmail,
        subscribed_at: new Date().toISOString(),
        subscription_source: 'homepage_newsletter',
        is_active: true,
        marketing_consent: true,
        metadata: attribution,
      });

    if (!minimalInsert.error) {
      return minimalInsert;
    }

    const fallbackLegacy = await supabase
      .from('marketing_newsletter_subscribers')
      .insert({
        email: normalizedEmail,
        status: 'active',
      });

    if (!fallbackLegacy.error) {
      return fallbackLegacy;
    }

    return minimalInsert;
  };

  const handleSubscribe = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setStatus('error');
      setMessage('Please enter a valid email address');
      return;
    }

    setStatus('loading');
    const attribution = getAttributionData();

    try {
      const normalizedEmail = email.toLowerCase().trim();
      const { error } = await insertSubscriberWithFallback(normalizedEmail, attribution);

      if (error) {
        // Check if it's a duplicate subscription
        if (error.code === '23505') {
          setStatus('error');
          setMessage('This email is already subscribed to our newsletter');
        } else if (error.code === '42P01') {
          setStatus('error');
          setMessage('Subscription service is not ready yet. Please try again in a moment.');
        } else if (error.code === '42501') {
          setStatus('error');
          setMessage('Subscription permission is blocked. Please contact support to enable newsletter signup.');
        } else {
          setStatus('error');
          setMessage('Failed to subscribe. Please try again.');
        }
        return;
      }

      // Trigger marketing automation workflow
      await triggerMarketingAutomation(normalizedEmail);
      trackMetaEvent('Lead', {
        content_name: 'Newsletter Subscription',
        content_category: 'marketing',
        lead_type: 'newsletter',
        value: 1,
        currency: 'USD',
      });
      trackMetaEvent('Subscribe', {
        content_name: 'Newsletter',
      });

      setStatus('success');
      setMessage('Welcome! Check your email for updates from XY Cargo.');
      setEmail('');

      // Reset status after 5 seconds
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 5000);
    } catch (err) {
      console.error('Newsletter subscription error:', err);
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  };

  const triggerMarketingAutomation = async (subscriberEmail: string) => {
    try {
      // Call Edge Function to trigger email automation
      const response = await supabase.functions.invoke('marketing-automation-trigger', {
        body: {
          email: subscriberEmail,
          event: 'newsletter_subscribe',
          source: 'homepage',
          metadata: {
            subscribed_at: new Date().toISOString(),
            ...getAttributionData(),
          },
        },
      });

      if (response.error) {
        console.error('Automation trigger error:', response.error);
      }
    } catch (err) {
      console.error('Failed to trigger marketing automation:', err);
      // Don't throw error - subscription was already successful
    }
  };

  return (
    <section className="bg-white px-6 py-16 reveal-on-scroll">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[32px] bg-white border border-slate-200/85 p-8 sm:p-12 shadow-xl shadow-slate-100/50">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/[0.02] rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative flex flex-col items-center justify-between gap-8 lg:flex-row z-10">
            <div className="space-y-2 text-center lg:text-left max-w-xl">
              <h2 className="text-2xl sm:text-3xl font-[900] uppercase tracking-tight text-slate-900 font-satoshi">
                Get Shipping Tips & <br className="hidden sm:inline" /> Exclusive Offers
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                Join over 5,000+ businesses and individuals receiving our weekly logistics updates, customs guides, and freight discounts.
              </p>
            </div>

            <div className="w-full max-w-md">
              <form onSubmit={handleSubscribe} className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row bg-slate-50 p-1.5 rounded-full border border-slate-200/80 shadow-inner w-full focus-within:border-[#d8000d] focus-within:ring-2 focus-within:ring-[#d8000d]/10 transition-all">
                  <Input
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={status === 'loading'}
                    className="h-11 border-0 bg-transparent px-4 text-sm text-slate-900 focus-visible:ring-0 shadow-none placeholder:text-slate-400 flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={status === 'loading' || status === 'success'}
                    className="h-11 rounded-full bg-[#d8000d] px-8 text-xs font-black uppercase tracking-widest text-white hover:bg-[#bf000c] transition-all hover:scale-[1.02] shadow-lg shadow-red-900/20"
                  >
                    {status === 'loading' ? 'Joining...' : 'Subscribe'}
                  </Button>
                </div>

                {/* Status Messages */}
                {status === 'success' && (
                  <div className="flex items-center justify-center lg:justify-start gap-2 text-green-600 font-bold px-4 animate-fade-in">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span className="text-xs">{message}</span>
                  </div>
                )}

                {status === 'error' && (
                  <div className="flex items-center justify-center lg:justify-start gap-2 text-red-600 font-bold px-4 animate-fade-in">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="text-xs">{message}</span>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewsletterCta;
