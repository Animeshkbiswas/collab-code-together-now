import React, { useState } from "react";
import {
  generateSummary,
  generateQuizFromSummary,
  generateMatchingPairsFromSummary,
} from "@/services/summarizerService";

export const YouTubeAIWorkflow: React.FC = () => {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<any[] | null>(null);
  const [pairs, setPairs] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);
    setQuiz(null);
    setPairs(null);

    try {
      // 1. Summarize the YouTube video
      const summaryData = await generateSummary({
        type: "youtube",
        youtubeUrl,
        length: "medium",
        style: "paragraph",
      });
      setSummary(summaryData.summary);

      // 2. Generate quiz from summary
      const quizData = await generateQuizFromSummary(summaryData.summary);
      setQuiz(quizData);

      // 3. Generate matching pairs from summary
      const pairsData = await generateMatchingPairsFromSummary(summaryData.summary);
      setPairs(pairsData);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">YouTube AI Summarizer & Quiz</h2>
      <input
        className="w-full border p-2 mb-4"
        type="text"
        placeholder="Paste YouTube video URL"
        value={youtubeUrl}
        onChange={(e) => setYoutubeUrl(e.target.value)}
      />
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded"
        onClick={handleProcess}
        disabled={loading || !youtubeUrl}
      >
        {loading ? "Processing..." : "Summarize & Generate"}
      </button>

      {error && <div className="text-red-600 mt-4">{error}</div>}

      {summary && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Summary</h3>
          <div className="bg-gray-100 p-3 rounded">{summary}</div>
        </div>
      )}

      {quiz && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Quiz</h3>
          <ol className="list-decimal ml-6">
            {quiz.map((q, idx) => (
              <li key={idx} className="mb-2">
                <div className="font-medium">{q.question}</div>
                <ul className="list-disc ml-6">
                  {q.options.map((opt: string, i: number) => (
                    <li key={i}>{opt}</li>
                  ))}
                </ul>
                <div className="text-green-700 text-sm">
                  Correct: {q.answer}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {pairs && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Matching Pairs</h3>
          <ul className="list-disc ml-6">
            {pairs.map((pair, idx) => (
              <li key={idx}>
                <strong>{pair.term}:</strong> {pair.definition}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}; 