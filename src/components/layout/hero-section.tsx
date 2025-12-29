interface HeroSectionProps {
  image: React.ReactNode;
  overlayText: string;
}

export function HeroSection({ image, overlayText }: HeroSectionProps) {
  return (
    <section className="w-full">
      <div className="relative w-full h-48 md:h-48">
        {/* Background Image */}
        {image}

        {/* Overlay Text */}
        <div className="absolute inset-0 flex items-end justify-start p-4">
          <h1 className="text-white text-7xl md:text-6xl font-medium">
            {overlayText}
          </h1>
        </div>
      </div>
    </section>
  );
}