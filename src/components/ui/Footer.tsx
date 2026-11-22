import Link from 'next/link';
import FooterContact from './FooterContact';

export default function Footer() {
  return (
    <footer className="bg-white">
      <FooterContact />
      <div className="border-t border-gray-100">
        <div className="container mx-auto px-4 pt-4 text-xs leading-5 text-gray-600">
          Hızlı Ulaşım bağımsız bir bilgilendirme hizmetidir ve herhangi bir kamu kurumunu temsil etmez.{' '}
          <Link href="/veri-kaynaklari" className="font-medium text-brand-dark-blue underline underline-offset-2">
            Resmî veri kaynaklarını görüntüleyin.
          </Link>
        </div>
      </div>
      <nav aria-label="Alt menü" className="container mx-auto px-4 py-4">
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
          <li>
            <Link href="/kunye" className="hover:text-brand-dark-blue">Künye</Link>
          </li>
          <li>
            <Link href="/veri-kaynaklari" className="hover:text-brand-dark-blue">Veri Kaynakları</Link>
          </li>
          <li>
            <Link href="/gizlilik-politikasi" className="hover:text-brand-dark-blue">Gizlilik Politikası</Link>
          </li>
          <li>
            <Link href="/cerez-politikasi" className="hover:text-brand-dark-blue">Çerez Politikası</Link>
          </li>
          <li>
            <Link href="/hesap-silme" className="hover:text-brand-dark-blue">Hesap ve Verilerin Silinmesi</Link>
          </li>
          <li>
            <Link href="/iletisim" className="hover:text-brand-dark-blue">İletişim</Link>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
