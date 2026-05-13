import express from 'express';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;
const distPath = path.join(process.cwd(), 'dist');

// Log presence of sensitive env vars (boolean only) to help verify deploys
console.log('GROQ_API_KEY set:', !!process.env.GROQ_API_KEY);

app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
