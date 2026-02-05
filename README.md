# 🚆 Train Time

![Repo Size](https://img.shields.io/github/repo-size/willblake01/train-time)
![Last Commit](https://img.shields.io/github/last-commit/willblake01/train-time)
![Open Issues](https://img.shields.io/github/issues/willblake01/train-time)
![Stars](https://img.shields.io/github/stars/willblake01/train-time?style=social)
![MIT License](https://img.shields.io/badge/license-MIT-green)

![Train Time](https://res.cloudinary.com/willblake01/image/upload/v1770242732/portfolio/train-time.webp)

**Train Time** is a real-time train scheduling web application built with a **production-oriented React/Next.js-style architecture**. The project emphasizes clean separation of concerns, predictable data flow, and extensibility — showcasing senior-level frontend engineering fundamentals rather than demo-only code.

---

## 🚀 Overview

Train Time allows users to:

- Add and view train schedules
- Calculate next arrival times and minutes away
- Persist schedule data using Firebase
- Dynamically update the UI in response to backend changes

The codebase is structured to scale, making it suitable for feature expansion, refactoring, and long-term maintenance.

---

## 🧠 Key Engineering Principles

- **Component-driven architecture** with clear responsibility boundaries
- **Centralized backend access** via utility abstractions
- **Deterministic time calculations**
- **Framework-level layout control** using custom `_app` and `_document`
- **Maintainable styling strategy**

---

## 🛠 Tech Stack

![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)

---

## 📁 Project Structure

```
train-time/
├─ components/
│  ├─ AddRoute/        # Form logic for adding train routes
│  ├─ Jumbotron/      # Hero / introductory UI
│  └─ Schedule/       # Train schedule display and calculations
│
├─ pages/
│  ├─ _app.js         # Global layout, styles, and providers
│  ├─ _document.js    # Custom document structure
│  └─ Landing/        # Primary landing page
│
├─ public/            # Static assets
├─ styles/            # Global and component-level styles
│
├─ utils/
│  ├─ firebaseConfig/ # Firebase initialization and configuration
│  └─ firebaseActions/# Database read/write abstractions
│
└─ README.md
```

---

## 🏗 Architecture Notes

- **Firebase access is isolated** in `utils/firebaseActions`, preventing UI components from coupling directly to backend APIs.
- **Page-level composition** lives in `pages`, while reusable UI logic remains in `components`.
- **Time-sensitive logic** is colocated with the schedule domain, keeping calculations explicit and testable.
- Custom `_app.js` and `_document.js` provide framework-level control and scalability.

This structure mirrors patterns used in real-world Next.js production applications.

---

## 📦 Features

- Add trains with destination, frequency, and first departure time
- Real-time updates from Firebase
- Automatic calculation of:
  - Next arrival time
  - Minutes until arrival
- Clean, responsive UI

---

## ⚙️ Setup & Installation

```bash
git clone https://github.com/willblake01/train-time.git
cd train-time
npm install
npm run dev
```

Or run without tooling by opening the app in a browser (if applicable).

---

## 🔧 Firebase Configuration

1. Create a Firebase project
2. Add your credentials to `utils/firebaseConfig`
3. Ensure database rules allow expected reads/writes

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

---

## 🧪 Testing Considerations

The architecture supports:

- Unit testing of Firebase action wrappers
- Pure function testing for schedule calculations
- Component testing with React Testing Library

---

## 📈 Potential Enhancements

- Authentication & user-specific schedules
- Editable and removable routes
- Timezone-aware scheduling
- Migration to modern date libraries
- Server-side rendering optimizations

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit with descriptive messages
4. Open a pull request

---

## 📜 License

MIT License
