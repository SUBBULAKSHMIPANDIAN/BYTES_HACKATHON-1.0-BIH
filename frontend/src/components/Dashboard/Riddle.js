import React, { useState, useEffect } from 'react';

const operators = ['+', '-', '×'];

const calculate = (num1, op, num2) => {
  switch(op) {
    case '+': return num1 + num2;
    case '-': return num1 - num2;
    case '×': return num1 * num2;
    default: return 0;
  }
};

const generateQuestion = () => {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const op = operators[Math.floor(Math.random() * operators.length)];
  return { 
    expression: `${num1} ${op} ${num2}`,
    answer: calculate(num1, op, num2)
  };
};

const Riddle = () => {
  const [question, setQuestion] = useState({});
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState({ message: '', isCorrect: false });
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [history, setHistory] = useState([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameActive, setGameActive] = useState(true);

  useEffect(() => {
    const savedHighScore = localStorage.getItem('mathHighScore');
    if (savedHighScore) setHighScore(parseInt(savedHighScore));
    loadQuestion();
  }, []);

  useEffect(() => {
    let timer;
    if (gameActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev <= 1 ? (setGameActive(false), 0) : prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameActive, timeLeft]);

  const loadQuestion = () => {
    setQuestion(generateQuestion());
    setUserInput('');
    setFeedback({ message: '', isCorrect: false });
  };

  const checkAnswer = () => {
    if (!gameActive || !userInput) return;
    const isCorrect = parseInt(userInput) === question.answer;
    
    setFeedback({
      message: isCorrect ? 'Correct!' : `Answer: ${question.answer}`,
      isCorrect
    });
    
    setScore(prev => {
      const newScore = isCorrect ? prev + 1 : prev;
      if (newScore > highScore) {
        setHighScore(newScore);
        localStorage.setItem('mathHighScore', newScore.toString());
      }
      return newScore;
    });
    
    setHistory(prev => [{
      question: question.expression,
      correctAnswer: question.answer,
      userAnswer: userInput,
      isCorrect,
      timestamp: new Date().toLocaleTimeString()
    }, ...prev.slice(0, 8)]);
    
    setTimeout(loadQuestion, 1200);
  };

  return (
    <div style={{
      fontFamily: "'Segoe UI', Tahoma, sans-serif",
      minHeight: '100vh',
      padding: '10px',
      backgroundColor: '#f5f5f5',
      color: '#333'
    }}>
      <div style={{
        maxWidth: '400px',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '15px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <h1 style={{ 
            color: '#185a9d',
            margin: 0,
            fontSize: '1.3rem'
          }}>
            Math Challenge
          </h1>
          <div style={{
            backgroundColor: '#e3f2fd',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            color: '#0d47a1'
          }}>
            Score: {score}
          </div>
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px'
        }}>
          <div style={{
            flex: 1,
            padding: '8px',
            backgroundColor: '#e3f2fd',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#546e7a' }}>High Score</div>
            <div style={{ fontSize: '1.1rem', color: '#0d47a1' }}>{highScore}</div>
          </div>
          <div style={{
            flex: 1,
            padding: '8px',
            backgroundColor: timeLeft <= 5 ? '#ffebee' : '#e3f2fd',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#546e7a' }}>Time Left</div>
            <div style={{ 
              fontSize: '1.1rem', 
              color: timeLeft <= 5 ? '#c62828' : '#0d47a1'
            }}>
              {timeLeft}s
            </div>
          </div>
        </div>

        {/* Question */}
        <div style={{
          fontSize: '1.5rem',
          textAlign: 'center',
          padding: '12px',
          backgroundColor: '#e3f2fd',
          borderRadius: '6px',
          margin: '12px 0',
          color: '#0d47a1'
        }}>
          {question.expression} = ?
        </div>

        {/* Input */}
        <input
          type="number"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && checkAnswer()}
          placeholder="Your answer"
          disabled={!gameActive}
          autoFocus
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '10px',
            fontSize: '0.9rem',
            border: '1px solid #bdbdbd',
            borderRadius: '5px',
            backgroundColor: '#ffffff',
            color: '#333'
          }}
        />

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button 
            onClick={checkAnswer}
            disabled={!gameActive || !userInput}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(to right, #43cea2, #185a9d)',
              color: '#fff',
              fontSize: '16px',
              cursor: 'pointer',
              opacity: (!gameActive || !userInput) ? 0.6 : 1
            }}
          >
            Submit
          </button>
          <button 
            onClick={() => { setGameActive(false); setTimeLeft(0); }}
            disabled={!gameActive}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(to right, #43cea2, #185a9d)',
              color: '#fff',
              fontSize: '16px',
              cursor: 'pointer',
              opacity: !gameActive ? 0.6 : 1
            }}
          >
            Stop
          </button>
        </div>

        {/* Feedback */}
        {feedback.message && (
          <div style={{
            padding: '8px',
            marginBottom: '12px',
            borderRadius: '5px',
            textAlign: 'center',
            backgroundColor: feedback.isCorrect ? '#e8f5e9' : '#ffebee',
            color: feedback.isCorrect ? '#2e7d32' : '#c62828',
            fontSize: '0.9rem'
          }}>
            {feedback.message}
          </div>
        )}

        {/* Game Over */}
        {!gameActive && (
          <div style={{ 
            textAlign: 'center',
            padding: '10px',
            marginBottom: '12px'
          }}>
            <div style={{ color: '#0d47a1', marginBottom: '6px' }}>
              {timeLeft === 0 ? "Time's Up!" : "Game Stopped"}
            </div>
            <button 
              onClick={() => {
                setScore(0);
                setTimeLeft(30);
                setGameActive(true);
                loadQuestion();
              }}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(to right, #43cea2, #185a9d)',
                color: '#fff',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Play Again
            </button>
          </div>
        )}

        {/* History */}
        <div>
          <div style={{ 
            color: '#0d47a1',
            fontSize: '0.9rem',
            marginBottom: '6px'
          }}>
            Recent Answers:
          </div>
          {history.length > 0 ? (
            <div style={{ 
              maxHeight: '150px',
              overflowY: 'auto',
              fontSize: '0.8rem'
            }}>
              {history.map((item, i) => (
                <div 
                  key={i}
                  style={{
                    padding: '6px',
                    marginBottom: '4px',
                    borderRadius: '4px',
                    backgroundColor: item.isCorrect ? '#e8f5e9' : '#ffebee',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>{item.question} = {item.correctAnswer}</span>
                  <span style={{ 
                    color: item.isCorrect ? '#2e7d32' : '#c62828',
                    fontWeight: 'bold'
                  }}>
                    You: {item.userAnswer}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ 
              color: '#757575',
              fontSize: '0.8rem',
              textAlign: 'center',
              padding: '10px'
            }}>
              No answers yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Riddle;