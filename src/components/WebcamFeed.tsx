import React, { useEffect, useRef } from 'react';

interface WebcamFeedProps {
  onVideoReady?: (video: HTMLVideoElement | null) => void;
  paused?: boolean;
}

export const WebcamFeed: React.FC<WebcamFeedProps> = ({ onVideoReady, paused }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (paused) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (onVideoReady) onVideoReady(null);
      return;
    }
    let stream: MediaStream | null = null;
    const getWebcam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          if (onVideoReady) onVideoReady(videoRef.current);
        }
      } catch (err) {
        if (onVideoReady) onVideoReady(null);
        // Optionally handle error
      }
    };
    getWebcam();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [paused, onVideoReady]);

  useEffect(() => {
    if (paused) {
      if (videoRef.current) videoRef.current.pause();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
      }
    } else {
      (async () => {
        if (!streamRef.current) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            streamRef.current = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play();
            }
          } catch (err) {
            // Optionally handle error
          }
        }
      })();
    }
  }, [paused]);

  return (
    <div className="rounded overflow-hidden border w-full max-w-xs mx-auto bg-black relative">
      <video
        ref={videoRef}
        width={240}
        height={180}
        autoPlay
        muted
        playsInline
        className="w-full h-auto object-cover bg-black"
        style={{ aspectRatio: '4/3' }}
      />
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 z-10">
          <span className="text-white text-lg font-semibold">Webcam Paused</span>
        </div>
      )}
      <div className="text-xs text-center text-gray-500 py-1">Webcam Preview</div>
    </div>
  );
}; 