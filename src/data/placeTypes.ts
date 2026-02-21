import type { LucideIcon } from "lucide-react";

type PlaceType = {
  slug: string;
  label: string;
};

type PlaceGroup = {
  title: string;
  icon?: LucideIcon;
  items: PlaceType[];
};

import {
  UtensilsCrossed,
  Train,
  Stethoscope,
  ShoppingBag,
  CreditCard,
  Building2,
  Landmark,
  Dumbbell,
  Wrench,
} from "lucide-react";

export const placeGroups: PlaceGroup[] = [
  {
    title: "Konaklama & Yeme-İçme",
    icon: UtensilsCrossed,
    items: [
      { slug: "restaurant", label: "Restoran" },
      { slug: "cafe", label: "Kafe" },
      { slug: "bar", label: "Bar" },
      { slug: "bakery", label: "Fırın / Pastane" },
      { slug: "meal_takeaway", label: "Paket yemek servisi" },
      { slug: "meal_delivery", label: "Yemek teslimatı" },
      { slug: "lodging", label: "Otel / Konaklama yeri" },
    ],
  },
  {
    title: "Ulaşım",
    icon: Train,
    items: [
      { slug: "airport", label: "Havalimanı" },
      { slug: "bus_station", label: "Otobüs durağı" },
      { slug: "subway_station", label: "Metro istasyonu" },
      { slug: "train_station", label: "Tren istasyonu" },
      { slug: "transit_station", label: "Aktarma istasyonu" },
      { slug: "taxi_stand", label: "Taksi durağı" },
      { slug: "parking", label: "Otopark" },
      { slug: "gas_station", label: "Benzin istasyonu" },
    ],
  },
  {
    title: "Sağlık",
    icon: Stethoscope,
    items: [
      { slug: "hospital", label: "Hastane" },
      { slug: "pharmacy", label: "Eczane" },
      { slug: "doctor", label: "Doktor muayenehanesi" },
      { slug: "dentist", label: "Dişçi" },
      { slug: "veterinary_care", label: "Veteriner kliniği" },
      { slug: "physiotherapist", label: "Fizik tedavi merkezi" },
    ],
  },
  {
    title: "Alışveriş",
    icon: ShoppingBag,
    items: [
      { slug: "supermarket", label: "Süpermarket" },
      { slug: "store", label: "Mağaza (genel)" },
      { slug: "shopping_mall", label: "Alışveriş merkezi" },
      { slug: "convenience_store", label: "Bakkal / küçük market" },
      { slug: "department_store", label: "Büyük mağaza" },
      { slug: "clothing_store", label: "Giyim mağazası" },
      { slug: "electronics_store", label: "Elektronik mağazası" },
      { slug: "furniture_store", label: "Mobilya mağazası" },
      { slug: "hardware_store", label: "Hırdavatçı" },
      { slug: "home_goods_store", label: "Ev eşyaları mağazası" },
      { slug: "jewelry_store", label: "Kuyumcu" },
      { slug: "liquor_store", label: "İçki dükkânı / Tekel" },
      { slug: "pet_store", label: "Pet shop" },
      { slug: "shoe_store", label: "Ayakkabı mağazası" },
      { slug: "book_store", label: "Kitapçı" },
    ],
  },
  {
    title: "Finans",
    icon: CreditCard,
    items: [
      { slug: "atm", label: "ATM" },
      { slug: "bank", label: "Banka" },
    ],
  },
  {
    title: "Kamu & Sosyal",
    icon: Building2,
    items: [
      { slug: "school", label: "Okul (genel)" },
      { slug: "primary_school", label: "İlkokul" },
      { slug: "secondary_school", label: "Ortaokul / Lise" },
      { slug: "university", label: "Üniversite" },
      { slug: "library", label: "Kütüphane" },
      { slug: "police", label: "Polis merkezi" },
      { slug: "post_office", label: "Postane" },
      { slug: "fire_station", label: "İtfaiye" },
      { slug: "courthouse", label: "Adliye" },
      { slug: "embassy", label: "Elçilik" },
      { slug: "city_hall", label: "Belediye binası" },
      { slug: "local_government_office", label: "Resmî daire" },
    ],
  },
  {
    title: "Kültür & Din",
    icon: Landmark,
    items: [
      { slug: "museum", label: "Müze" },
      { slug: "art_gallery", label: "Sanat galerisi" },
      { slug: "movie_theater", label: "Sinema" },
      { slug: "mosque", label: "Cami" },
      { slug: "church", label: "Kilise" },
      { slug: "hindu_temple", label: "Hindu tapınağı" },
      { slug: "synagogue", label: "Sinagog" },
      { slug: "cemetery", label: "Mezarlık" },
    ],
  },
  {
    title: "Spor & Eğlence",
    icon: Dumbbell,
    items: [
      { slug: "stadium", label: "Stadyum" },
      { slug: "gym", label: "Spor salonu" },
      { slug: "spa", label: "Spa merkezi" },
      { slug: "zoo", label: "Hayvanat bahçesi" },
      { slug: "aquarium", label: "Akvaryum" },
      { slug: "park", label: "Park" },
      { slug: "tourist_attraction", label: "Turistik yer" },
      { slug: "bowling_alley", label: "Bowling salonu" },
      { slug: "campground", label: "Kamp alanı" },
    ],
  },
  {
    title: "Diğer Hizmetler",
    icon: Wrench,
    items: [
      { slug: "car_rental", label: "Araç kiralama" },
      { slug: "car_repair", label: "Oto tamirci" },
      { slug: "car_dealer", label: "Oto galerici" },
      { slug: "bicycle_store", label: "Bisiklet mağazası" },
      { slug: "travel_agency", label: "Seyahat acentesi" },
      { slug: "beauty_salon", label: "Güzellik salonu" },
      { slug: "hair_care", label: "Kuaför" },
      { slug: "laundry", label: "Çamaşırhane" },
      { slug: "locksmith", label: "Çilingir" },
      { slug: "moving_company", label: "Nakliyat şirketi" },
      { slug: "painter", label: "Boyacı" },
      { slug: "plumber", label: "Tesisatçı" },
      { slug: "real_estate_agency", label: "Emlak ofisi" },
      { slug: "roofing_contractor", label: "Çatı ustası" },
      { slug: "storage", label: "Depolama tesisi" },
      { slug: "electrician", label: "Elektrikçi" },
    ],
  },
];
