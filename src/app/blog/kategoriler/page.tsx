'use client';

import Link from 'next/link';
import { useCategories } from '../../../hooks/useWordPress';
import { BlogCategory } from '../../../types/WordPress';

export default function CategoriesPage() {
  const { data: categories, isLoading, isError, error } = useCategories();

  const getCategoryColor = (index: number) => {
    const colors = [
      'bg-brand-soft-blue hover:bg-brand-dark-blue',
      'bg-brand-dark-blue hover:bg-brand-soft-blue', 
      'bg-brand-light-blue hover:bg-brand-soft-blue text-gray-800',
      'bg-brand-yellow hover:bg-brand-green text-gray-800',
      'bg-brand-green hover:bg-brand-yellow text-gray-800',
      'bg-brand-gray hover:bg-brand-dark-blue text-gray-800',
    ];
    return colors[index % colors.length];
  };

  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Hata Oluştu</h1>
          <p className="text-gray-600 mb-4">
            {error?.message || 'Kategoriler yüklenirken bir hata oluştu'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-brand-soft-blue text-white px-4 py-2 rounded hover:bg-brand-dark-blue transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-12">
        <nav className="flex text-sm text-gray-600 mb-6">
          <Link href="/blog" className="hover:text-brand-soft-blue">
            Blog
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Kategoriler</span>
        </nav>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Blog Kategorileri
        </h1>
        <p className="text-xl text-gray-600">
          İlgi alanınıza göre kategorileri keşfedin ve içeriklere göz atın
        </p>
      </div>

      {/* Categories Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
              <div className="w-full h-32 bg-gray-200 rounded-lg mb-4"></div>
              <div className="w-24 h-6 bg-gray-200 rounded mb-3"></div>
              <div className="w-full h-4 bg-gray-200 rounded mb-2"></div>
              <div className="w-3/4 h-4 bg-gray-200 rounded mb-4"></div>
              <div className="w-20 h-4 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : categories && categories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {categories.map((category: BlogCategory, index) => (
            <Link 
              key={category.id} 
              href={`/blog/${category.slug}`}
              className="block group"
            >
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 group-hover:border-gray-300">
                {/* Category Color Header */}
                <div className={`h-32 ${getCategoryColor(index)} flex items-center justify-center relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-black bg-opacity-10"></div>
                  <h3 className="text-2xl font-bold text-white z-10 text-center">
                    {category.name}
                  </h3>
                </div>
                
                {/* Category Content */}
                <div className="p-6">
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 group-hover:text-brand-soft-blue transition-colors">
                      {category.name}
                    </h4>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {category.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {category.postCount} gönderi
                    </span>
                    <span className="text-brand-soft-blue text-sm font-medium group-hover:text-brand-dark-blue">
                      Keşfet →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7H5m14 14H5" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Henüz kategori bulunmuyor
          </h3>
          <p className="text-gray-500 mb-6">
            Blog kategorileri yakında eklenecek
          </p>
          <Link 
            href="/blog"
            className="text-brand-soft-blue hover:text-brand-dark-blue font-medium"
          >
            ← Blog ana sayfasına dön
          </Link>
        </div>
      )}

      {/* Bottom CTA */}
      {categories && categories.length > 0 && (
        <div className="mt-16 text-center">
          <div className="bg-gray-50 rounded-lg p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Aradığınız kategoriyi bulamadınız mı?
            </h3>
            <p className="text-gray-600 mb-4">
              Tüm blog gönderilerine göz atın veya arama yapın
            </p>
            <Link 
              href="/blog"
              className="inline-flex items-center px-6 py-3 bg-brand-soft-blue text-white rounded-lg hover:bg-brand-dark-blue transition-colors"
            >
              Tüm Gönderileri Gör
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}