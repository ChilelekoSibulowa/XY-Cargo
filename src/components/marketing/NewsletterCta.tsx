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
    <section className="bg-white px-6 py-10 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-2xl bg-[#fff5f5] px-6 py-6 md:px-10 md:py-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="space-y-0.5 text-center md:text-left">
              <h2 className="text-[20px] font-bold tracking-tight text-slate-900">
                Get Shipping Tips & Exclusive Offers
              </h2>
              <p className="text-sm text-slate-600 font-medium">
                Join our community of over 5,000+ businesses and individuals.
              </p>
            </div>

            <div className="w-full max-w-sm">
              <form onSubmit={handleSubscribe} className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row bg-white p-1.5 rounded-xl shadow-sm border border-slate-100">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={status === 'loading'}
                    className="h-10 border-0 bg-transparent px-3 text-sm focus-visible:ring-0 shadow-none placeholder:text-slate-400"
                  />
                  <Button
                    type="submit"
                    disabled={status === 'loading' || status === 'success'}
                    className="h-10 rounded-lg bg-[#d8000d] px-6 text-sm font-bold text-white hover:bg-[#bf000c] transition-all active:scale-[0.95]"
                  >
                    {status === 'loading' ? 'Joining...' : 'Subscribe'}
                  </Button>
                </div>

                {/* Status Messages */}
                {status === 'success' && (
                  <div className="flex items-center gap-2 text-green-600 font-semibold px-2 animate-fade-in">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-xs">{message}</span>
                  </div>
                )}

                {status === 'error' && (
                  <div className="flex items-center gap-2 text-red-600 font-semibold px-2 animate-fade-in">
                    <AlertCircle className="h-4 w-4" />
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
