import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChartStyleSelector } from './ChartStyleSelector';

// Simple icon component for testing
function MockIcon({ className, ...props }) {
  return <svg className={className} {...props} data-testid="mock-icon" />;
}

const mockStyles = [
  { id: 'bar', label: 'Barras', icon: MockIcon },
  { id: 'line', label: 'Linhas', icon: MockIcon },
  { id: 'pie', label: 'Pizza', icon: MockIcon },
];

describe('ChartStyleSelector', () => {
  it('calls onChange with the correct style ID when a button is clicked', () => {
    const onChange = vi.fn();

    render(
      <ChartStyleSelector
        styles={mockStyles}
        activeStyle="bar"
        onChange={onChange}
      />,
    );

    // Click the "Linhas" button (not active)
    const lineButton = screen.getByLabelText('Linhas');
    fireEvent.click(lineButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('line');
  });

  it('does NOT call onChange when clicking the already active style', () => {
    const onChange = vi.fn();

    render(
      <ChartStyleSelector
        styles={mockStyles}
        activeStyle="bar"
        onChange={onChange}
      />,
    );

    // Click the active button
    const barButton = screen.getByLabelText('Barras');
    fireEvent.click(barButton);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks the active style button with aria-pressed="true"', () => {
    render(
      <ChartStyleSelector
        styles={mockStyles}
        activeStyle="line"
        onChange={vi.fn()}
      />,
    );

    const lineButton = screen.getByLabelText('Linhas');
    const barButton = screen.getByLabelText('Barras');
    const pieButton = screen.getByLabelText('Pizza');

    expect(lineButton).toHaveAttribute('aria-pressed', 'true');
    expect(barButton).toHaveAttribute('aria-pressed', 'false');
    expect(pieButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies distinct styling to the active button', () => {
    render(
      <ChartStyleSelector
        styles={mockStyles}
        activeStyle="pie"
        onChange={vi.fn()}
      />,
    );

    const pieButton = screen.getByLabelText('Pizza');
    const barButton = screen.getByLabelText('Barras');

    // Active button has bg-[#58706d] class (white text, colored bg)
    expect(pieButton.className).toContain('bg-[#58706d]');
    expect(pieButton.className).toContain('text-white');

    // Inactive button does NOT have the active background
    expect(barButton.className).not.toContain('bg-[#58706d]');
    expect(barButton.className).not.toContain('text-white');
  });
});
