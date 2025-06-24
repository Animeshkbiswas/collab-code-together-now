import React, { useState } from "react";
import {
  generateSummary,
  generateQuizFromSummary,
  generateMatchingPairsFromSummary,
} from "@/services/summarizerService";
import { generateQuiz } from "@/services/aiQuizService";
import { isValidYouTubeInput, TranscriptError } from "@/services/transcriptService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Youtube, 
  FileText, 
  Brain, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Play,
  BookOpen,
  Target
} from "lucide-react";

export const YouTubeAIWorkflow: React.FC = () => {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [manualTranscript, setManualTranscript] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<any[] | null>(null);
  const [pairs, setPairs] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'input' | 'processing' | 'results'>('input');
  const [processingStep, setProcessingStep] = useState<string>('');

  const handleProcess = async () => {
    if (!youtubeUrl.trim()) {
      setError("Please enter a YouTube URL");
      return;
    }

    if (!isValidYouTubeInput(youtubeUrl)) {
      setError("Please enter a valid YouTube URL");
      return;
    }

    setLoading(true);
    setError(null);
    setSummary(null);
    setQuiz(null);
    setPairs(null);
    setCurrentStep('processing');

    try {
      // Step 1: Generate summary
      setProcessingStep('Extracting transcript and generating summary...');
      const summaryData = await generateSummary({
        type: "youtube",
        youtubeUrl,
        length: "medium",
        style: "paragraph",
        manualTranscript: manualTranscript || undefined,
      });
      setSummary(summaryData.summary);

      // Step 2: Generate quiz from summary
      setProcessingStep('Generating quiz questions...');
      const quizData = await generateQuiz({
        content: summaryData.summary,
        videoTitle: summaryData.source.videoId || 'YouTube Video',
        videoId: summaryData.source.videoId,
        youtubeUrl: youtubeUrl,
        difficulty: 'medium',
        numQuestions: 5,
        manualTranscript: manualTranscript || undefined,
      });
      setQuiz(quizData.questions);

      // Step 3: Generate matching pairs from summary
      setProcessingStep('Generating matching pairs...');
      const pairsData = await generateMatchingPairsFromSummary(summaryData.summary);
      setPairs(pairsData);

      setCurrentStep('results');
    } catch (err: any) {
      console.error('YouTube AI Workflow error:', err);
      
      // Handle specific transcript errors
      if (err.message && err.message.includes('transcript')) {
        setError(`Transcript extraction failed: ${err.message}\n\nPlease provide the transcript manually below or try a different video with captions enabled.`);
        setShowManualInput(true);
      } else {
        setError(err.message || "An error occurred during processing");
      }
      
      setCurrentStep('input');
    } finally {
      setLoading(false);
      setProcessingStep('');
    }
  };

  const handleManualTranscriptSubmit = async () => {
    if (!manualTranscript.trim()) {
      setError("Please provide a transcript");
      return;
    }

    setShowManualInput(false);
    await handleProcess();
  };

  const resetForm = () => {
    setYoutubeUrl("");
    setManualTranscript("");
    setShowManualInput(false);
    setSummary(null);
    setQuiz(null);
    setPairs(null);
    setError(null);
    setCurrentStep('input');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Youtube className="h-6 w-6 text-red-600" />
            YouTube AI Summarizer & Quiz Generator
          </CardTitle>
          <CardDescription>
            Extract transcripts from YouTube videos and generate summaries, quizzes, and matching games using AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentStep === 'input' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="youtube-url">YouTube Video URL</Label>
                <Input
                  id="youtube-url"
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={loading}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="whitespace-pre-line">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {showManualInput && (
                <div className="space-y-2">
                  <Label htmlFor="manual-transcript">Manual Transcript (Fallback)</Label>
                  <Textarea
                    id="manual-transcript"
                    placeholder="Paste the video transcript here if automatic extraction fails..."
                    value={manualTranscript}
                    onChange={(e) => setManualTranscript(e.target.value)}
                    rows={6}
                  />
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleManualTranscriptSubmit}
                      disabled={loading || !manualTranscript.trim()}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Process with Manual Transcript
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowManualInput(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <Button 
                onClick={handleProcess} 
                disabled={loading || !youtubeUrl.trim()}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Generate Summary & Quiz
                  </>
                )}
              </Button>
            </>
          )}

          {currentStep === 'processing' && (
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <div className="space-y-2">
                <p className="font-medium">{processingStep}</p>
                <p className="text-sm text-gray-600">This may take a few moments...</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {currentStep === 'results' && (
        <div className="space-y-6">
          {/* Summary Section */}
          {summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  AI-Generated Summary
                </CardTitle>
                <CardDescription>
                  Comprehensive summary of the YouTube video content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="whitespace-pre-line">{summary}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <Badge variant="secondary">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    AI Generated
                  </Badge>
                  <Badge variant="outline">
                    {summary.length} characters
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quiz Section */}
          {quiz && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Generated Quiz ({quiz.length} questions)
                </CardTitle>
                <CardDescription>
                  Multiple choice questions based on the video content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {quiz.map((q, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">
                        {idx + 1}. {q.question}
                      </h4>
                      <div className="space-y-2">
                        {q.options.map((opt: string, i: number) => (
                          <div 
                            key={i} 
                            className={`p-2 rounded ${
                              i === q.correctAnswer 
                                ? 'bg-green-100 border-green-300' 
                                : 'bg-gray-50'
                            }`}
                          >
                            {String.fromCharCode(65 + i)}. {opt}
                            {i === q.correctAnswer && (
                              <Badge variant="secondary" className="ml-2">
                                Correct
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                      {q.explanation && (
                        <div className="mt-3 p-3 bg-blue-50 rounded text-sm">
                          <strong>Explanation:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Matching Pairs Section */}
          {pairs && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Matching Game Pairs ({pairs.length} pairs)
                </CardTitle>
                <CardDescription>
                  Term-definition pairs for interactive learning games
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {pairs.map((pair, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Term</Label>
                          <p className="font-medium">{pair.term}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Definition</Label>
                          <p>{pair.definition}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={resetForm} variant="outline">
              Process Another Video
            </Button>
            <Button onClick={() => window.print()}>
              <FileText className="h-4 w-4 mr-2" />
              Print Results
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}; 