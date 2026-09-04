type AnswerSummaryProps = {
  html: string;
};

export default function AnswerSummary({ html }: AnswerSummaryProps) {
  if (html === '') return null;

  return (
    <section
      aria-label="Kısa cevap"
      className="mb-6 rounded-xl border-l-4 border-brand-orange bg-orange-50 px-4 py-3 text-base leading-7 text-gray-800 [&_p]:m-0"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
