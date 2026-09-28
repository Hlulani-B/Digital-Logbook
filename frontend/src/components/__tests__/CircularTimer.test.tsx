import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CircularTimer } from '../CircularTimer';

describe('CircularTimer', () => {
  const defaultProps = {
    elapsedMs: 21000, // 21 seconds
    targetMs: 60000, // 60 seconds
    isRunning: false,
    isPaused: false,
    isCompleted: false,
  };

  it('renders time display', () => {
    render(<CircularTimer {...defaultProps} />);
    expect(screen.getByText('00:21')).toBeInTheDocument();
  });

  it('renders hours when elapsed time is over an hour', () => {
    render(<CircularTimer {...defaultProps} elapsedMs={3661000} />);
    expect(screen.getByText('01:01:01')).toBeInTheDocument();
  });

  it('shows play button when not running', () => {
    const onStart = vi.fn();
    render(<CircularTimer {...defaultProps} onStart={onStart} />);
    const playBtn = screen.getByRole('button', { name: /start timer/i });
    expect(playBtn).toBeInTheDocument();
    fireEvent.click(playBtn);
    expect(onStart).toHaveBeenCalled();
  });

  it('shows pause button when running', () => {
    const onPause = vi.fn();
    render(<CircularTimer {...defaultProps} isRunning={true} onPause={onPause} />);
    const pauseBtn = screen.getByRole('button', { name: /pause timer/i });
    expect(pauseBtn).toBeInTheDocument();
    fireEvent.click(pauseBtn);
    expect(onPause).toHaveBeenCalled();
  });

  it('shows play button when paused', () => {
    const onStart = vi.fn();
    render(<CircularTimer {...defaultProps} isPaused={true} onStart={onStart} />);
    const playBtn = screen.getByRole('button', { name: /resume timer/i });
    expect(playBtn).toBeInTheDocument();
    fireEvent.click(playBtn);
    expect(onStart).toHaveBeenCalled();
  });

  it('shows stop button when running', () => {
    const onStop = vi.fn();
    render(<CircularTimer {...defaultProps} isRunning={true} onStop={onStop} />);
    const stopBtn = screen.getByRole('button', { name: /stop timer/i });
    expect(stopBtn).toBeInTheDocument();
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalled();
  });

  it('does not show controls when completed', () => {
    render(<CircularTimer {...defaultProps} isCompleted={true} />);
    expect(screen.queryByRole('button', { name: /start timer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /stop timer/i })).not.toBeInTheDocument();
  });

  it('renders SVG with correct dimensions', () => {
    const { container } = render(<CircularTimer {...defaultProps} size={250} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '250');
    expect(svg).toHaveAttribute('height', '250');
  });

  it('calculates progress correctly', () => {
    const { container } = render(
      <CircularTimer {...defaultProps} elapsedMs={30000} targetMs={60000} />
    );
    const progressRing = container.querySelector('.circular-timer-ring');
    expect(progressRing).toBeInTheDocument();
    // At 50% progress, stroke-dashoffset should be half of circumference
    const style = progressRing?.getAttribute('style') || '';
    expect(style).toContain('stroke-dashoffset');
  });

  it('applies correct ring color based on state', () => {
    const { container, rerender } = render(<CircularTimer {...defaultProps} />);

    // Default (not running) - gray
    let ring = container.querySelector('.circular-timer-ring');
    expect(ring).toHaveAttribute('stroke', '#d1d5db');

    // Running - purple
    rerender(<CircularTimer {...defaultProps} isRunning={true} />);
    ring = container.querySelector('.circular-timer-ring');
    expect(ring).toHaveAttribute('stroke', '#8b5cf6');

    // Paused - amber
    rerender(<CircularTimer {...defaultProps} isPaused={true} />);
    ring = container.querySelector('.circular-timer-ring');
    expect(ring).toHaveAttribute('stroke', '#f59e0b');

    // Completed - green
    rerender(<CircularTimer {...defaultProps} isCompleted={true} />);
    ring = container.querySelector('.circular-timer-ring');
    expect(ring).toHaveAttribute('stroke', '#10b981');
  });
});
