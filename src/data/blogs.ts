export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  category: string; // e.g., "nasıl giderim"
  categoryId: number; // numeric category id
  excerpt?: string;
  date: string; // ISO string
  url?: string; // optional absolute path if pages exist
};

// NOTE: Placeholder content. Replace with real data or connect to a CMS later.
export const blogs: BlogPost[] = [
  {
    id: "1",
    title: "Üsküdar'a Nasıl Giderim?",
    slug: "uskudar-nasil-giderim",
    category: "nasıl giderim",
    categoryId: 2,
    excerpt: "Üsküdar'a toplu taşıma ve alternatif güzergahlar...",
    date: new Date().toISOString(),
    url: "/blog/uskudar-nasil-giderim",
  },
  {
    id: "2",
    title: "Kadıköy'e Nasıl Giderim?",
    slug: "kadikoy-nasil-giderim",
    category: "nasıl giderim",
    categoryId: 2,
    excerpt: "Vapur, metro ve otobüsle Kadıköy ulaşım rehberi...",
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    url: "/blog/kadikoy-nasil-giderim",
  },
  {
    id: "3",
    title: "Beşiktaş'a Nasıl Giderim?",
    slug: "besiktas-nasil-giderim",
    category: "nasıl giderim",
    categoryId: 2,
    excerpt: "Avrupa yakasının kalbine en hızlı ulaşım önerileri...",
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    url: "/blog/besiktas-nasil-giderim",
  },
  {
    id: "4",
    title: "Taksim'e Nasıl Giderim?",
    slug: "taksim-nasil-giderim",
    category: "nasıl giderim",
    categoryId: 2,
    excerpt: "M2 metro hattı ve alternatif rota ipuçları...",
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    url: "/blog/taksim-nasil-giderim",
  },
  {
    id: "5",
    title: "Sabiha Gökçen'e Nasıl Giderim?",
    slug: "sabiha-gokcen-nasil-giderim",
    category: "nasıl giderim",
    categoryId: 2,
    excerpt: "Havaist, belediye otobüsleri ve taksi alternatifleri...",
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    url: "/blog/sabiha-gokcen-nasil-giderim",
  },
  {
    id: "6",
    title: "İstanbul Havalimanı'na Nasıl Giderim?",
    slug: "istanbul-havalimani-nasil-giderim",
    category: "nasıl giderim",
    categoryId: 2,
    excerpt: "M11 metro hattı ve Havaist ile ulaşım...",
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    url: "/blog/istanbul-havalimani-nasil-giderim",
  },
];
