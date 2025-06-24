# Milestone-Based Game System Implementation

This document explains how the milestone system works in the StudySync application.

## Overview

The milestone system tracks video progress and triggers interactive elements at specific progress points (25%, 50%, 75%) to enhance learning engagement.

## Key Components

### 1. Dashboard Component (`src/components/Dashboard.tsx`)

The main component that manages the milestone UI state and modal display.

**Key Features:**
- Tracks video progress
- Shows milestone modals
- Manages game state
- Handles user interactions

**State Management:**
```typescript
const [progress, setProgress] = useState<number>(0);
const [showMilestoneModal, setShowMilestoneModal] = useState<boolean>(false);
const [currentMilestone, setCurrentMilestone] = useState<number | null>(null);
```

### 2. YouTubePlayer Component (`src/components/YouTubePlayer.tsx`)

Handles the core milestone logic and video control.

**Key Features:**
- Tracks video progress in real-time
- Triggers milestones at 25%, 50%, 75%
- Auto-pauses video when modal appears
- Auto-resumes video when modal closes
- Prevents duplicate milestone triggers

**Milestone Logic:**
```typescript
const checkMilestones = useCallback((progress: number) => {
  if (showGame) return;  // Guard against re-triggering while modal is open

  const milestones = [25, 50, 75];
  const lastTriggered = lastMilestonePopup;

  for (const milestone of milestones) {
    if (
      progress >= milestone &&
      !milestonesReached.has(milestone) &&
      lastTriggered !== milestone
    ) {
      setMilestonesReached(prev => new Set([...prev, milestone]));
      setCurrentMilestone(milestone as 25 | 50 | 75);
      setLastMilestonePopup(milestone as 25 | 50 | 75);
      onMilestoneReached?.(milestone);
      break;
    }
  }
}, [milestonesReached, showGame, onMilestoneReached, lastMilestonePopup]);
```

## How It Works

### 1. Progress Tracking
- YouTubePlayer tracks video progress every second when playing
- Progress is calculated as: `(currentTime / duration) * 100`

### 2. Milestone Detection
- System checks for milestones at 25%, 50%, and 75%
- Each milestone can only be triggered once per video session
- Guards prevent re-triggering while modal is open

### 3. Video Control
- Video automatically pauses when milestone modal appears
- Video automatically resumes when modal is closed
- Progress tracking continues during modal display

### 4. User Interaction
- Users can choose to play a mini-game or skip
- Modal provides clear feedback about milestone achievement
- Navigation to games page is seamless

## Usage Example

```typescript
// In Dashboard component
const handleMilestoneReached = (milestone: number) => {
  console.log('Milestone reached:', milestone);
  setCurrentMilestone(milestone);
  setShowMilestoneModal(true);
  toast({
    title: "Milestone Reached!",
    description: `You've reached ${milestone}% of the video!`
  });
};

// Pass to YouTubePlayer
<YouTubePlayer
  videoId={videoId}
  title={currentVideoTitle}
  onProgressUpdate={handleProgressUpdate}
  onMilestoneReached={handleMilestoneReached}
  emotionDetectionPaused={emotionDetectionPaused}
  setEmotionDetectionPaused={setEmotionDetectionPaused}
/>
```

## Benefits

1. **Engagement**: Breaks up long videos with interactive elements
2. **Retention**: Reinforces learning through mini-games
3. **Progress Tracking**: Visual feedback on learning progress
4. **User Control**: Users can choose to engage or skip
5. **Seamless Experience**: Video automatically pauses/resumes

## Future Enhancements

- Customizable milestone percentages
- Different game types for different milestones
- Progress persistence across sessions
- Achievement badges for milestone completion
- Social sharing of milestones

## Technical Notes

- Uses React hooks for state management
- Implements proper cleanup to prevent memory leaks
- Handles edge cases (video seeking, pausing, etc.)
- Integrates with existing emotion analysis system
- Follows TypeScript best practices 