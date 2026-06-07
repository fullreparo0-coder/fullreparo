type OpenPdfViewerInput = {
  src: string;
  title: string;
  filename: string;
  back: string;
};

export function buildPdfViewerUrl({ src, title, filename, back }: OpenPdfViewerInput) {
  const params = new URLSearchParams({
    src,
    title,
    filename,
    back,
  });
  return `/painel/pdf?${params.toString()}`;
}
