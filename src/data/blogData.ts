import { BlogData } from '../types/Blog';

export const blogData: BlogData = {
  categories: [
    {
      id: '1',
      name: 'Teknoloji',
      slug: 'teknoloji',
      description: 'En son teknoloji haberleri ve gelişmeleri',
      postCount: 15,
      color: 'blue'
    },
    {
      id: '2',
      name: 'Yazılım',
      slug: 'yazilim',
      description: 'Programlama, geliştirme araçları ve yazılım dünyası',
      postCount: 12,
      color: 'green'
    },
    {
      id: '3',
      name: 'Tasarım',
      slug: 'tasarim',
      description: 'UI/UX tasarım, grafik tasarım ve yaratıcı içerikler',
      postCount: 8,
      color: 'purple'
    },
    {
      id: '4',
      name: 'Girişimcilik',
      slug: 'girisimcilik',
      description: 'Startup dünyası, girişimcilik hikayeleri ve iş dünyası',
      postCount: 10,
      color: 'orange'
    }
  ],
  posts: [
    {
      id: '1',
      title: 'React 18 ile Yeni Özellikler',
      slug: 'react-18-yeni-ozellikler',
      excerpt: 'React 18 ile gelen concurrent rendering, automatic batching ve diğer yenilikler hakkında detaylı bilgi.',
      content: 'React 18, React ekosisteminde önemli değişiklikler getiriyor. Concurrent rendering ile performans artışı sağlanırken, automatic batching ile state güncellemeleri daha verimli hale geliyor...',
      categorySlug: 'yazilim',
      author: {
        name: 'Ahmet Yılmaz',
        avatar: '/avatars/ahmet.jpg'
      },
      publishedAt: '2024-03-15',
      readTime: 5,
      tags: ['React', 'JavaScript', 'Frontend'],
      featuredImage: '/blog/react-18.jpg'
    },
    {
      id: '2',
      title: 'Yapay Zeka Geleceği Nasıl Şekillendiriyor',
      slug: 'yapay-zeka-gelecegi',
      excerpt: 'AI teknolojilerinin günlük hayatımıza etkileri ve gelecekte bizi neler bekliyor.',
      content: 'Yapay zeka teknolojileri artık hayatımızın her alanında kendini gösteriyor. ChatGPT, DALL-E gibi araçlar yaratıcı süreçleri değiştirirken...',
      categorySlug: 'teknoloji',
      author: {
        name: 'Zeynep Kaya',
        avatar: '/avatars/zeynep.jpg'
      },
      publishedAt: '2024-03-10',
      readTime: 8,
      tags: ['AI', 'Machine Learning', 'Future'],
      featuredImage: '/blog/ai-future.jpg'
    },
    {
      id: '3',
      title: 'Modern Web Tasarım Trendleri',
      slug: 'modern-web-tasarim-trendleri',
      excerpt: '2024 yılında öne çıkan web tasarım trendleri ve bunları projelerinizde nasıl uygulayabileceğiniz.',
      content: 'Web tasarım dünyası sürekli değişiyor. Minimalizm, dark mode, mikro animasyonlar ve accessibility öncelikli tasarım yaklaşımları...',
      categorySlug: 'tasarim',
      author: {
        name: 'Mehmet Özkan',
        avatar: '/avatars/mehmet.jpg'
      },
      publishedAt: '2024-03-05',
      readTime: 6,
      tags: ['Web Design', 'UI/UX', 'Trends'],
      featuredImage: '/blog/web-design-trends.jpg'
    },
    {
      id: '4',
      title: 'Startup Kurma Rehberi: İlk Adımlar',
      slug: 'startup-kurma-rehberi',
      excerpt: 'Girişimcilik yolculuğuna başlayanlar için pratik rehber ve öneriler.',
      content: 'Bir startup kurmak heyecan verici bir süreç. İdea validasyonundan MVP geliştirmeye, fonlama seçeneklerinden takım kurma stratejilerine...',
      categorySlug: 'girisimcilik',
      author: {
        name: 'Fatma Şahin',
        avatar: '/avatars/fatma.jpg'
      },
      publishedAt: '2024-02-28',
      readTime: 12,
      tags: ['Startup', 'Entrepreneurship', 'Business'],
      featuredImage: '/blog/startup-guide.jpg'
    },
    {
      id: '5',
      title: 'Next.js 14 App Router Detaylı İnceleme',
      slug: 'nextjs-14-app-router',
      excerpt: 'Next.js 14 ile gelen App Router özelliklerini derinlemesine inceleyelim.',
      content: 'Next.js 14 ile beraber App Router stabil hale geldi. Server Components, client components arasındaki fark ve route handlers...',
      categorySlug: 'yazilim',
      author: {
        name: 'Ali Demir',
        avatar: '/avatars/ali.jpg'
      },
      publishedAt: '2024-02-20',
      readTime: 10,
      tags: ['Next.js', 'React', 'Full-stack'],
      featuredImage: '/blog/nextjs-14.jpg'
    },
    {
      id: '6',
      title: 'Blockchain Teknolojisi ve Web3',
      slug: 'blockchain-teknolojisi-web3',
      excerpt: 'Blockchain teknolojisinin temelleri ve Web3 ekosistemindeki yeri.',
      content: 'Blockchain teknolojisi merkeziyetsizlik ilkesi üzerine kurulu. Smart contract\'lar, DeFi protokolleri ve NFT\'ler...',
      categorySlug: 'teknoloji',
      author: {
        name: 'Burak Yıldırım',
        avatar: '/avatars/burak.jpg'
      },
      publishedAt: '2024-02-15',
      readTime: 15,
      tags: ['Blockchain', 'Web3', 'Cryptocurrency'],
      featuredImage: '/blog/blockchain-web3.jpg'
    }
  ]
};