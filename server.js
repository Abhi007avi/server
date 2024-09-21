const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');
const cors = require('cors');
const XLSX = require('xlsx');
const app = express();
const port = 5000;
app.use(cors());

// Parse JSON form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MySQL connection pool
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',        // Your MySQL username
  password: 'Pass#123', // Your MySQL password
  database: 'mydb'     // Your database name
});

// Set storage engine with multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    // Ensure the uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir); // Set destination directory
  },
  filename: (req, file, cb) => {
    const documentName = req.body.documentName || `${file.originalname}`;
    cb(null, `${documentName}${path.extname(file.originalname)}`); // Use custom filename or default
  }
});

// Initialize upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 }, // Set a file size limit (optional)
}).single('documentFile'); // Name of the form field

// Endpoint to handle file uploads and metadata
app.post('/upload', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(500).json({ message: 'File upload failed', error: err });
    }

    const { documentName, documentRevision, documentCode, documentDepartment, documentType, revisionDate } = req.body;
    const filePath = req.file ? req.file.path : null;

    // Insert metadata into the MySQL database
    const query = `
      INSERT INTO documents (document_name, document_revision, document_code, department, document_type, file_path, revision_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [documentName, documentRevision, documentCode, documentDepartment, documentType, filePath, revisionDate];

    db.query(query, values, (dbErr, result) => {
      if (dbErr) {
        console.error('Database insertion error:', dbErr);
        return res.status(500).json({ message: 'Failed to save document metadata', error: dbErr });
      }

      res.status(200).json({ message: 'File uploaded and metadata saved successfully', file: req.file });
    });
  });
});

// Endpoint to retrieve documents by department
app.get('/documents/department/:department', (req, res) => {
  const department = req.params.department;

  // Query to retrieve documents by department
  const query = 'SELECT * FROM documents WHERE department = ?';
  
  db.query(query, [department], (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ message: 'Failed to retrieve documents', error: err });
    }
    
    // Return the list of documents
    res.status(200).json(results);
  });
});


app.get('/document/:filename', (req, res) => {
  const filename = req.params.filename;
  console.log('Requested filename:', filename);

  
  const query = 'SELECT * FROM documents WHERE document_name = ?'; // Using document_name as specified

  db.query(query, [filename], (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ message: 'Failed to retrieve document', error: err });
    }

    // Check if any results were found
    if (results.length === 0) {
  console.log('Document not found');
    return res.status(404).json({ message: 'Document not found' });
    }

    const document = results[0];
    const filePath = path.join(__dirname, 'uploads', path.basename(document.file_path)); // Ensure document.file_path is valid

    // Check if the file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        console.error('File access error:', err);
        return res.status(404).json({ message: 'File not found' });
      }
      
      res.setHeader('Content-Disposition', 'inline'); // Use 'inline' to display in the browser

      
      // Send the file as a response
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error('File sending error:', err);
          return res.status(500).json({ message: 'Failed to send file', error: err });
        }
      });
    });
  });
}); 

// Start the server
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
