import { AccessibilityWidget } from '@haktantekin/noblock';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-brand-light-blue bg-white">
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
            <Link href="/iletisim" className="hover:text-brand-dark-blue">İletişim</Link>
          </li>
        </ul>
      </nav>
 <AccessibilityWidget
        title="Accessibility"
        resetText="Reset"
        fontSize={1}
        lineHeight={1.5}
        letterSpacing={0}
        color="#10366e"
        fontSizeLabel="Font Size"
        lineHeightLabel="Line Height"
        letterSpacingLabel="Letter Spacing"
        labelHighContrast="High Contrast"
        labelInvertColors="Invert Colors"
        labelGrayscale="Grayscale"
        labelReadableFont="Readable Font"
        labelUnderlineLinks="Underline Links"
        labelLargeCursor="Large Cursor"
        labelPauseAnimations="Pause Animations"
        labelSimplifyPage="Simplify Page"
        labelDyslexiaFriendly="Dyslexia Friendly"
        labelHideImages="Hide Images"
      />

    </footer>
  );
}
