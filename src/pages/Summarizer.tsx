import { Navbar } from '@/components/Navbar';
import { SummarizerTab } from '@/components/SummarizerTab';

// Summarizer Page: AI-powered summarization for documents, websites, YouTube videos, and images
// This page provides a consistent layout with the Progress page and is accessible from the Navbar.

const Summarizer = () => {
  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Summarizer</h1>
            <p className="text-gray-600">Use Nebius AI to summarize documents, websites, YouTube videos, and images</p>
          </div>
          <SummarizerTab />
        </div>
      </div>
    </div>
  );
};

export default Summarizer; 