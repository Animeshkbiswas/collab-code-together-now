// Update this page (the content is just a fallback if you fail to update the page)

import React from "react";
import { YouTubeAIWorkflow } from "@/components/YouTubeAIWorkflow";

const IndexPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4">Welcome to Your Blank App</h1>
      <p className="text-xl text-muted-foreground">Start building your amazing project here!</p>
    </div>
    <YouTubeAIWorkflow />
  </div>
);

export default IndexPage;
