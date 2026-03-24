import type { Metadata } from 'next';
import { Mail, MapPin } from 'lucide-react';
import ContactForm from '@/components/ui/ContactForm';

export const metadata: Metadata = {
  title: 'İletişim - Hızlı Ulaşım',
  description: 'Hızlı Ulaşım ile iletişime geçin. Soru, öneri ve geri bildirimleriniz için bize yazın.',
  alternates: { canonical: 'https://hizliulasim.com/iletisim' },
};

export default function Page() {
  return (
    <div className="container mx-auto px-4 pt-6 pb-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">İletişim</h1>
      <p className="text-gray-600 text-sm mb-6">
        Soru, öneri veya geri bildirimleriniz için aşağıdaki formu doldurabilirsiniz.
      </p>

      <div className="flex flex-col gap-3 mb-8 text-sm">
        <div className="flex items-center gap-2 text-gray-700">
          <Mail className="w-4 h-4 text-brand-dark-blue flex-shrink-0" />
          <span>iletisim@hizliulasim.com</span>
        </div>
        <div className="flex items-center gap-2 text-gray-700">
          <MapPin className="w-4 h-4 text-brand-dark-blue flex-shrink-0" />
          <span>İstanbul, Türkiye</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <ContactForm />
      </div>
    </div>
  );
}
