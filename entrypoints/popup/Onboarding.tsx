import React from 'react';
import './Onboarding.css';
import './App.css'; // Import to access container styles

interface OnboardingProps {
  currentSlide: number;
  onNext: () => void;
  onComplete: () => void;
}

export default function Onboarding({ currentSlide, onNext, onComplete }: OnboardingProps) {
  const slides = [
    {
      id: 1,
      title: "NoMoScroll!",
      subtitle: "Welcome",
      content: "We help you build healthier digital habits",
      image: "/generated-image (14).png",
      buttonText: "Get Started"
    },
    {
      id: 2,
      title: "Smart Scroll Limits",
      subtitle: "Set boundaries that matter",
      content: "",
      image: "/scroll-limit-demo.png",
      buttonText: "Next"
    },
    {
      id: 3,
      title: "You're All Set!",
      subtitle: "Ready to build better habits",
      content: "Start using NoMoScroll to create a more intentional browsing experience. You can always adjust settings later.",
      buttonText: "Start Using"
    }
  ];

  const currentSlideData = slides[currentSlide - 1];

  const handleButtonClick = () => {
    if (currentSlide === 3) {
      onComplete();
    } else {
      onNext();
    }
  };

  return (
    <div className="container breathing-background">
      <div className="onboarding-content">
        <div className="slide-content">
          <h1 className="slide-title">{currentSlideData.title}</h1>
          <h2 className="slide-subtitle">{currentSlideData.subtitle}</h2>
          {currentSlideData.image && (
            <img 
              src={currentSlideData.image} 
              alt="Feature demonstration"
              className="slide-image"
            />
          )}
          {currentSlideData.content && (
            <p className="slide-description">{currentSlideData.content}</p>
          )}
        </div>

        <div className="onboarding-actions">
          <button 
            className="onboarding-button primary"
            onClick={handleButtonClick}
          >
            {currentSlideData.buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
