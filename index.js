const express = require('express');
//const fs = require('fs').promises;
const fs = require('fs');

const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(express.json());

const dataPath = path.join(__dirname, 'top250.json');
const managerPath = path.join(__dirname, 'manager.json');

// functions managing manager.json
const readManagers = () => {
  try {
    const data = fs.readFileSync(managerPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading managers:', error);
    return [];
  }
};

const writeManagers = (managers) => {
  try {
    fs.writeFileSync(managerPath, JSON.stringify(managers, null, 2));
    console.log('Managers written to file successfully');
  } catch (error) {
    console.error('Error writing managers:', error);
  }
};

// endpoint manager.json
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;

  // Check if email already exists
  const managers = readManagers();
  const existingManager = managers.find((manager) => manager.email === email);
  if (existingManager) {
    return res.status(400).json({ message: 'Email already exists' });
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Generate a unique ID (you can use a library like `uuid`)
  let newId = 1; // Adjust for existing IDs
  if (managers.length > 0) {
    newId = managers[managers.length - 1].id + 1;
  }

  // Create a new manager object
  const newManager = {
    id: newId,
    email,
    password: hashedPassword,
    super: false // Adjust default super status if needed
  };

  // Add the new manager to the managers array
  managers.push(newManager);

  // Write the updated managers list to manager.json
  writeManagers(managers);

  res.status(201).json({ message: 'Manager registered successfully' });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // Read managers from manager.json
  const managers = readManagers();

  // Find the manager by email
  const manager = managers.find((manager) => manager.email === email);
  if (!manager) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Compare passwords
  const isPasswordValid = await bcrypt.compare(password, manager.password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Create JWT token
  const token = jwt.sign({ userId: manager.id, userEmail: manager.email }, 'your_secret_key', {
    expiresIn: '5m', // Token expires in 5 minutes
  });

  res.json({ token });
});


// functions
async function readData() {
  try {
    const data = await fs.readFile(dataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data:', error);
    return [];
  }
}

async function writeData(data) {
    try {
        await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing data:', error);
        return Promise.reject(error);
    }
}

let films;
(async () => {
  try {
    films = await readData();
  } catch (error) {
    console.error('Error initializing films:', error);
  }
})();

app.get('/api/films/readall', (req, res) => {
  res.status(200).json(films.sort((a, b) => a.position - b.position));
});

app.get('/api/films/read/:id', (req, res) => {
  const { id } = req.params;
  const film = films.find(f => f.id === parseInt(id));

  if (!film) {
    return res.status(404).json({ message: 'Film not found' });
  }

  res.status(200).json(film);
});

app.post('/api/films/create', (req, res) => {
  const newFilm = req.body;

  if (!newFilm.title || !newFilm.rating || !newFilm.year || !newFilm.budget || !newFilm.gross || !newFilm.poster) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (isNaN(newFilm.year) || newFilm.year < 1888) {
    return res.status(400).json({ message: 'Invalid year' });
  }

  if (newFilm.budget < 0 || newFilm.gross < 0) {
    return res.status(400).json({ message: 'Budget and gross cannot be negative' });
  }

  newFilm.id = films.length + 1;

  const existingFilm = films.find(f => f.position === newFilm.position);

  if (existingFilm) {
    films.forEach(film => {
        if (film.position >= newFilm.position) {
        film.position++;
      }
    });
  }

  films.push(newFilm);
  writeData(films);
  res.json(newFilm);
});

app.post('/api/films/update/:id', async (req, res) => {
    console.log('req.body console ', req.body);
    console.log('req.params ', req.params);

    const { id } = req.params;
    const updateFields = req.body;

    const filmIndex = films.findIndex(f => f.id === parseInt(id));

    if (filmIndex === -1) {
        return res.status(404).json({ message: 'Film not found' });
    }

    const allowedFields = ['title', 'rating', 'year', 'budget', 'gross', 'poster', 'position'];
    const validUpdateFields = Object.keys(updateFields).filter(key => allowedFields.includes(key));
    console.log('valid ', validUpdateFields)
    const updatedFilm = { ...films[filmIndex], ...validUpdateFields };
    console.log('update ', updatedFilm);
    if (updateFields.position) {
        const existingFilm = films.find(f => f.position === updateFields.position);

        if (existingFilm && existingFilm.id !== id) {
            films.forEach((film, index) => {
                if (film.position >= updateFields.position && film.id !== id) {
                    film.position++;
                }
            });
        }
    }

    films[filmIndex] = updatedFilm;

    try {
        await writeData(films);
        res.json(updatedFilm);
    } catch (error) {
        console.error('Error updating film:', error);
        res.status(500).json({ message: 'Error updating film' });
    }
});

app.post('/api/films/delete/:id', (req, res) => {
  const { id } = req.params;

  const filmIndex = films.findIndex(f => f.id === parseInt(id));
  if (filmIndex === -1) {
    return res.status(404).json({ message: 'Film not found' });
  }

  films.splice(filmIndex, 1);

  films.forEach((film, index) => {
    if (index > filmIndex) {
      film.position--;
    }
  });

  writeData(films);
  res.json({ message: 'Film deleted' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
