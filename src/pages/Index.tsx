import { Hero } from '@/components/landing/Hero';
import { LiveFeed } from '@/components/landing/LiveFeed';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { SupportedGames } from '@/components/landing/SupportedGames';

const Index = () => {
  return (
    <>
      <Hero />
      <LiveFeed />
      <HowItWorks />
      <SupportedGames />
    </>
  );
};

export default Index;
