import React from 'react';

export default function Chart() {
  // Mock chart data - in production, this would use a charting library
  const data = [
    { month: 'Jan', value: 65 },
    { month: 'Feb', value: 75 },
    { month: 'Mar', value: 85 },
    { month: 'Apr', value: 70 },
    { month: 'May', value: 90 },
    { month: 'Jun', value: 95 }
  ];

  return (
    <div className="h-64 flex items-end justify-between space-x-2">
      {data.map((item, index) => (
        <div key={index} className="flex flex-col items-center flex-1">
          <div
            className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
            style={{ height: `${item.value}%` }}
          />
          <span className="text-xs text-gray-600 mt-2">{item.month}</span>
        </div>
      ))}
    </div>
  );
}