// lib/cf-image-loader.ts
export default function cfLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  // Only rewrite R2 images
  if (!src.includes(process.env.NEXT_PUBLIC_R2_PUBLIC_URL!)) return src;
  const q = quality ?? 75;
  return src.replace(
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL!,
    `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/cdn-cgi/image/width=${width},quality=${q},format=auto`
  );
}