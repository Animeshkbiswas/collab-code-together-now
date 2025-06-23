import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Link, 
  Youtube, 
  Image, 
  Upload, 
  Download, 
  Copy, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  ExternalLink,
  File,
  Globe
} from 'lucide-react';
import { generateSummary, SummaryRequest, SummaryResponse } from '@/services/summarizerService';

interface SummarizerTabProps {}

export const SummarizerTab: React.FC<SummarizerTabProps> = () => {
  const [activeTab, setActiveTab] = useState<'text' | 'url' | 'youtube' | 'image' | 'file'>('text');
  const [inputText, setInputText] = useState('');
  const [url, setUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [summaryLength, setSummaryLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [summaryStyle, setSummaryStyle] = useState<'bullet' | 'paragraph' | 'detailed'>('paragraph');
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [fileInputRef] = useState(useRef<HTMLInputElement>(null));
  const [imageInputRef] = useState(useRef<HTMLInputElement>(null));

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      setError('');
    } else {
      setError('Please select a valid image file');
    }
  };

  const validateInput = (): boolean => {
    setError('');
    
    switch (activeTab) {
      case 'text':
        if (!inputText.trim()) {
          setError('Please enter some text to summarize');
          return false;
        }
        break;
      case 'url':
        if (!url.trim()) {
          setError('Please enter a URL to summarize');
          return false;
        }
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          setError('Please enter a valid URL starting with http:// or https://');
          return false;
        }
        break;
      case 'youtube':
        if (!youtubeUrl.trim()) {
          setError('Please enter a YouTube URL to summarize');
          return false;
        }
        if (!youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be')) {
          setError('Please enter a valid YouTube URL');
          return false;
        }
        break;
      case 'file':
        if (!selectedFile) {
          setError('Please select a file to summarize');
          return false;
        }
        break;
      case 'image':
        if (!imageFile) {
          setError('Please select an image to summarize');
          return false;
        }
        break;
    }
    
    return true;
  };

  const handleGenerateSummary = async () => {
    if (!validateInput()) return;

    setIsGenerating(true);
    setError('');
    setSummary('');

    try {
      const request: SummaryRequest = {
        type: activeTab,
        content: inputText,
        url: url,
        youtubeUrl: youtubeUrl,
        file: selectedFile,
        imageFile: imageFile,
        length: summaryLength,
        style: summaryStyle
      };

      const response: SummaryResponse = await generateSummary(request);
      setSummary(response.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopySummary = async () => {
    if (summary) {
      try {
        await navigator.clipboard.writeText(summary);
        // You could add a toast notification here
      } catch (err) {
        console.error('Failed to copy summary:', err);
      }
    }
  };

  const handleDownloadSummary = () => {
    if (summary) {
      const blob = new Blob([summary], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `summary-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const getInputContent = () => {
    switch (activeTab) {
      case 'text':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="input-text">Text Content</Label>
              <Textarea
                id="input-text"
                placeholder="Paste or type the text you want to summarize..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={8}
                className="resize-none"
              />
            </div>
          </div>
        );
      
      case 'url':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="url-input">Website URL</Label>
              <div className="flex gap-2">
                <Input
                  id="url-input"
                  type="url"
                  placeholder="https://example.com/article"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <Button variant="outline" size="sm" onClick={() => window.open(url, '_blank')} disabled={!url}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      
      case 'youtube':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="youtube-url">YouTube URL</Label>
              <div className="flex gap-2">
                <Input
                  id="youtube-url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                />
                <Button variant="outline" size="sm" onClick={() => window.open(youtubeUrl, '_blank')} disabled={!youtubeUrl}>
                  <Youtube className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      
      case 'file':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-input">Document File</Label>
              <div className="flex gap-2">
                <Input
                  id="file-input"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".txt,.pdf,.doc,.docx,.md,.rtf"
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
              </div>
              {selectedFile && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded-md">
                  <File className="h-4 w-4" />
                  <span className="text-sm">{selectedFile.name}</span>
                  <Badge variant="secondary">{selectedFile.size} bytes</Badge>
                </div>
              )}
            </div>
          </div>
        );
      
      case 'image':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="image-input">Image File</Label>
              <div className="flex gap-2">
                <Input
                  id="image-input"
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex-1"
                >
                  <Image className="h-4 w-4 mr-2" />
                  Choose Image
                </Button>
              </div>
              {imageFile && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded-md">
                  <Image className="h-4 w-4" />
                  <span className="text-sm">{imageFile.name}</span>
                  <Badge variant="secondary">{imageFile.size} bytes</Badge>
                </div>
              )}
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AI Summarizer
          </CardTitle>
          <CardDescription>
            Use Nebius AI to summarize documents, websites, YouTube videos, and images
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Type Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="text" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Text
              </TabsTrigger>
              <TabsTrigger value="url" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Website
              </TabsTrigger>
              <TabsTrigger value="youtube" className="flex items-center gap-2">
                <Youtube className="h-4 w-4" />
                YouTube
              </TabsTrigger>
              <TabsTrigger value="file" className="flex items-center gap-2">
                <File className="h-4 w-4" />
                Document
              </TabsTrigger>
              <TabsTrigger value="image" className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Image
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {getInputContent()}
            </TabsContent>
          </Tabs>

          {/* Summary Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="summary-length">Summary Length</Label>
              <Select value={summaryLength} onValueChange={(value) => setSummaryLength(value as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short (2-3 sentences)</SelectItem>
                  <SelectItem value="medium">Medium (4-6 sentences)</SelectItem>
                  <SelectItem value="long">Long (8-10 sentences)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="summary-style">Summary Style</Label>
              <Select value={summaryStyle} onValueChange={(value) => setSummaryStyle(value as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bullet">Bullet Points</SelectItem>
                  <SelectItem value="paragraph">Paragraph</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerateSummary}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Summary...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Summary
              </>
            )}
          </Button>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Summary Result */}
          {summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Summary Generated
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopySummary}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadSummary}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm bg-muted p-4 rounded-md">
                    {summary}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}; 