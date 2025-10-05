import { homeCardDatas } from '@/data/homeCardDatas';
import Link from 'next/link';

const HomeCards = () => {
  return (
    <>
      <h2 className="mt-5 font-bold text-2xl">Bloglara Göz Atın</h2>
      <div className="flex overflow-x-scroll w-full gap-3 mt-5">
        {homeCardDatas.map((item) => {
          const IconComponent = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`${item.bgColor} ${item.textColor} min-w-[140px] relative p-4 rounded-xl font-medium text-xs hover:opacity-80 transition-opacity flex gap-1.5 min-h-[100px] flex-col items-center`}
            >
              <div className="bg-white/70 w-10 h-10 mx-auto rounded-full flex items-center justify-center">
                <IconComponent size={20} />
              </div>
              <div
                className="text-base flex items-center justify-center w-full text-center leading-5 min-h-[50px]"
                dangerouslySetInnerHTML={{ __html: item.label }}
              />

            </Link>
          );
        })}
      </div>
    </>
  );
};

export default HomeCards;