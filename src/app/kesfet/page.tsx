import SearchBar from "@/components/home/SearchBar";
import ExploreCategories from "@/components/explore/ExploreCategories";

export default function KesfetPage() {
  return (
    <div className="container mx-auto pb-4 px-4 pt-6">
      <div className='text-gray-400 text-lg mb-4'>
        Sana <span className='text-dark-blue font-bold text-xl'>en yakın</span> yerleri keşfet!
      </div>
      <div className="w-full mb-4">
        <SearchBar />
      </div>
      <ExploreCategories />
    </div>
  );
}
