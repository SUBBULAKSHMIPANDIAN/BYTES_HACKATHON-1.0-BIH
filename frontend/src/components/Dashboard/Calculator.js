import React, { useState } from 'react';
import { evaluate } from 'mathjs';

const ScientificCalculator = () => {
  const [showCalc, setShowCalc] = useState(false);
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');

  const handleClick = (value) => {
    if (value === 'C') {
      setExpression('');
      setResult('');
    } else if (value === '=') {
      try {
        const evalResult = evaluate(expression);
        setResult(evalResult.toString());
      } catch {
        setResult('Error');
      }
    } else {
      const updatedValue = value === 'π' ? 'pi' : value;
      setExpression((prev) => prev + updatedValue);
    }
  };

  return (
    <div>
      {/* Centered Button Wrapper */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <button onClick={() => setShowCalc(true)} style={styles.calculatorBtn}>
          Calculator
        </button>
      </div>

      {showCalc && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2 style={{ marginBottom: '10px' }}>Calculator</h2>
            <input
              value={expression}
              readOnly
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '1.2rem',
                marginBottom: '10px',
                borderRadius: '6px',
                border: '1px solid #ccc',
              }}
            />
            <div style={{ marginBottom: '10px' }}>
              <strong>Result:</strong> {result}
            </div>

            <div style={styles.keypad}>
              {[
                '7', '8', '9', '/', 'π',
                '4', '5', '6', '*', '√(',
                '1', '2', '3', '-', 'log(',
                '0', '.', '=', '+', 'sin(',
                'cos(', 'tan(', '(', ')', 'C'
              ].map((btn, i) => (
                <button key={i} onClick={() => handleClick(btn)} style={styles.button}>
                  {btn}
                </button>
              ))}
            </div>

            <button onClick={() => setShowCalc(false)} style={styles.closeBtn}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  calculatorBtn: {
    background: 'linear-gradient(to right, #38b2ac, #3182ce)',
    color: '#fff',
    padding: '10px 20px',
    fontSize: '1rem',
    fontWeight: '500',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
    transition: 'background 0.3s ease',
  },
  overlay: {
    position: 'fixed',
    top: 0, left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modal: {
    background: 'white',
    padding: '2rem',
    borderRadius: '12px',
    width: '400px',
    boxShadow: '0 0 20px rgba(0,0,0,0.3)',
    textAlign: 'center'
  },
  keypad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '10px',
    marginBottom: '1rem'
  },
  button: {
    padding: '10px',
    fontSize: '1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  closeBtn: {
    padding: '8px 16px',
    background: '#d33',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  }
};

export default ScientificCalculator;
