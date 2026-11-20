import Link from 'next/link';
import FooterContact from './FooterContact';

export default function Footer() {
  return (
    <footer className="bg-white">
      <FooterContact />
      <nav aria-label="Alt menü" className="container mx-auto px-4 py-4">
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
          <li>
            <Link href="/kunye" className="hover:text-brand-dark-blue">Künye</Link>
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
