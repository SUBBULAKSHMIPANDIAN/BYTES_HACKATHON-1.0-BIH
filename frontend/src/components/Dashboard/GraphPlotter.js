import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { evaluate } from 'mathjs';
import './GraphPlotter.css';

import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const GraphPlotter = () => {
  const [expression, setExpression] = useState('');
  const [dataPoints, setDataPoints] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    try {
      const xValues = [];
      const yValues = [];

      for (let x = -10; x <= 10; x += 0.5) {
        const y = evaluate(expression, { x });
        if (isFinite(y)) {
          xValues.push(x);
          yValues.push(y);
        }
      }

      setDataPoints({ x: xValues, y: yValues });
      setShowModal(true); // ✅ Show modal
    } catch (error) {
      alert("Invalid expression");
    }
  };

  const closeModal = () => setShowModal(false);

  return (
    <div className="graph-container">
      <h2>📈 Graph Plotter</h2>
      <form onSubmit={handleSubmit} className="graph-form">
        <input
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          placeholder="Enter expression (e.g., x^2)"
        />
        <button type="submit">Plot</button>
      </form>

      {/* ✅ Modal Overlay */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={closeModal}>✖</button>
            <Line
              data={{
                labels: dataPoints.x,
                datasets: [
                  {
                    label: `y = ${expression}`,
                    data: dataPoints.y,
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    pointRadius: 0,
                    fill: true,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: { title: { display: true, text: 'x' } },
                  y: { title: { display: true, text: 'y' } },
                },
                plugins: {
                  legend: { position: 'top' },
                  title: {
                    display: true,
                    text: 'Function Plot',
                    font: { size: 18 },
                  },
                },
              }}
              height={400}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphPlotter;
