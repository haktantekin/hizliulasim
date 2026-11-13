export interface GoogleAccountLinkView {
  linked: boolean;
  title: string;
  description: string;
}

const SAFE_LINK_ERRORS = new Set([
  'Google hesabının e-postası üyelik e-postanızla eşleşmiyor.',
  'Bu Google hesabı başka bir üyeliğe bağlı.',
  'Üyeliğiniz başka bir Google hesabına bağlı.',
  'Google hesabını bağlamak için yeniden giriş yapın.',
  'Google hesabı bağlama şu anda kullanılamıyor.',
  'Google kimliği geçersiz.',
  'Google hesabı doğrulanamadı.',
  'Google hesabı bağlanamadı.',
  'Google kimliği alınamadı.',
  'Google ile giriş şu anda kullanılamıyor.',
]);

export function getGoogleAccountLinkView(linked: boolean): GoogleAccountLinkView {
  return linked
    ? {
        linked: true,
        title: 'Google hesabı bağlı',
        description: 'Bu üyelikte Google ile giriş yapabilirsiniz.',
      }
    : {
        linked: false,
        title: 'Google hesabı bağlı değil',
        description: 'Aynı e-postaya sahip Google hesabınızı bağlayarak sonraki girişlerde Google butonunu kullanabilirsiniz.',
      };
}

export function getGoogleLinkErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return SAFE_LINK_ERRORS.has(message)
    ? message
    : 'Google hesabı bağlanamadı. Lütfen tekrar deneyin.';
}
