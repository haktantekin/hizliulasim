import Link from 'next/link';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { MapPin, ParkingCircle, Navigation } from 'lucide-react';

const sections = [
  {
    href: '/engelsiz-erisim/engelsiz-mekanlar',
    icon: MapPin,
    label: 'Engelsiz Mekanlar',
    desc: 'Tekerlekli sandalye dostu restoran, kafe, müze ve daha fazlası. Giriş, park ve tuvalet erişilebilirlik bilgileri.',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    href: '/engelsiz-erisim/engelsiz-otoparklar',
    icon: ParkingCircle,
    label: 'Engelsiz Otoparklar',
    desc: 'İSPARK otoparkları arasında engelli park yeri bilgisi ve anlık doluluk durumu.',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    href: '/engelsiz-erisim/engelsiz-rota',
    icon: Navigation,
    label: 'Engelsiz Rota',
    desc: 'Tekerlekli sandalye dostu güzergah planlama. Asansörlü ve rampalı rotalar öncelikli.',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
  },
];

export default function EngelsizErisimPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">♿</span>
          <h1 className="text-xl font-bold text-gray-900">Engelsiz Erişim</h1>
        </div>
        <p className="text-sm text-gray-500">
          Engelli bireylerin şehir içi ulaşımını kolaylaştıran erişilebilirlik bilgileri.
          Tekerlekli sandalye dostu duraklar, mekanlar, otoparklar ve rota planlama.
        </p>
      </div>

      <Breadcrumb className="mb-6 -mt-2" items={[{ label: 'Engelsiz Erişim' }]} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className={`flex flex-col gap-3 p-5 rounded-xl border ${s.color} hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center gap-3">
                <Icon size={24} />
                <h2 className="text-lg font-semibold">{s.label}</h2>
              </div>
              <p className="text-sm opacity-80">{s.desc}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <h3 className="font-semibold mb-2">♿ Erişilebilirlik Hakkında</h3>
        <p>
          Bu bölümdeki veriler İETT, İSPARK ve Google Maps API&apos;lerinden alınmaktadır.
          Erişilebilirlik bilgileri sürekli güncellenmekte olup, lütfen ziyaret öncesinde
          ilgili kurumdan teyit almanızı öneririz.
        </p>
      </div>
    </div>
  );
}
