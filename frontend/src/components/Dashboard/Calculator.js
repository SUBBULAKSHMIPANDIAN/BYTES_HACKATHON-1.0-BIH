import React, { useState } from 'react';
import { evaluate } from 'mathjs';

const ScientificCalculator = () => {
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

  // Only handle special keys in keyDown, let onChange handle regular input
  const handleKeyDown = (e) => {
    // Handle Enter key as equals
    if (e.key === 'Enter') {
      e.preventDefault();
      try {
        const evalResult = evaluate(expression);
        setResult(evalResult.toString());
      } catch {
        setResult('Error');
      }
    }
    // Handle Backspace
    else if (e.key === 'Backspace') {
      setExpression(prev => prev.slice(0, -1));
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Calculator</h2>
      <input
        value={expression}
        onChange={(e) => setExpression(e.target.value)}
        onKeyDown={handleKeyDown}
        style={styles.input}
      />
      <div style={styles.result}>
        Result: <span style={styles.resultValue}>{result}</span>
      </div>

      <div style={styles.keypad}>
        {[
          '7', '8', '9', '/', 'π',
          '4', '5', '6', '*', '√(',
          '1', '2', '3', '-', 'log(',
          '0', '.', '=', '+', 'sin(',
          'cos(', 'tan(', '(', ')', 'C'
        ].map((btn, i) => (
          <button 
            key={i} 
            onClick={() => handleClick(btn)} 
            style={styles.button}
          >
            {btn}
          </button>
        ))}
      </div>
    </div>
  );
};

const styles = {
  container: {
    background: 'linear-gradient(to right, rgb(102, 126, 234), rgb(118, 75, 162))',
    padding: '2rem',
    borderRadius: '12px',
    width: '350px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    textAlign: 'center',
  
  },
  title: {
    marginBottom: '10px',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#fff'
  },
  input: {
    width: '100%',
    padding: '10px',
    fontSize: '1.2rem',
    marginBottom: '10px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    background: 'rgba(255,255,255,0.9)',
  },
  result: {
    marginBottom: '20px',
    fontWeight: 'bold',
    fontSize: '1.2rem',
    color: '#fff',
  },
  resultValue: {
    fontWeight: 'normal',
    fontSize: '1.6rem',
    color: '#fff',
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
    background: 'rgba(255,255,255,0.8)',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  '@media (max-width: 768px)': {
    container: {
      width: '150px',
      padding: '1rem',
    },
    input: {
      fontSize: '1rem',
    },
    button: {
      fontSize: '0.9rem',
      padding: '8px',
    },
    title: {
      fontSize: '1.2rem',
    },
    result: {
      fontSize: '1rem',
    },
    resultValue: {
      fontSize: '1.4rem',
    },
    },
};

export default ScientificCalculator;