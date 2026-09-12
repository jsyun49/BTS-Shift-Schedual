import { useEffect, useRef, useState } from 'react';

interface ColorPickerDotProps {
  value: string;
  onSave: (color: string) => void;
  size?: 'sm' | 'md';
}

export default function ColorPickerDot({ value, onSave, size = 'md' }: ColorPickerDotProps) {
  const [color, setColor] = useState(value);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setColor(value);
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newColor = e.target.value;
    setColor(newColor);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => onSave(newColor), 400);
  }

  return (
    <input
      type="color"
      value={color}
      onChange={handleChange}
      title="클릭하여 색상 변경"
      className={`inline-block cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 align-middle ${
        size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'
      }`}
      style={{ backgroundColor: color }}
    />
  );
}
