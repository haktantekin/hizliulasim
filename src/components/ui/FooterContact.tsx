import { Mail, MessageCircle } from 'lucide-react';
import ContactForm from '@/components/ui/ContactForm';

export default function FooterContact() {
  return (
    <section
      aria-labelledby="footer-contact-title"
      className="border-b border-t border-brand-light-blue/60 bg-slate-50"
    >
      <div className="container mx-auto px-4 py-4">
        <div className="grid gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-[minmax(190px,0.55fr)_minmax(0,1.45fr)] md:items-center md:p-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-brand-soft-blue">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light-blue/30">
                <MessageCircle aria-hidden="true" className="h-4 w-4" />
              </span>
              <h2 id="footer-contact-title" className="text-base font-bold text-gray-900">
                Bize yazın
              </h2>
            </div>
            <p className="max-w-sm text-xs leading-5 text-gray-500">
              Görüş, öneri veya hata bildiriminizi kısaca iletin.
            </p>
            <a
              href="mailto:iletisim@hizliulasim.com"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-soft-blue hover:underline"
            >
              <Mail aria-hidden="true" className="h-3.5 w-3.5" />
              iletisim@hizliulasim.com
            </a>
          </div>

          <ContactForm variant="compact" />
        </div>
      </div>
    </section>
  );
}
