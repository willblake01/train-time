import React from 'react';
import '../styles/global.css';
import Head from 'next/head';
import Landing from './Landing';

const App = () => (
  <>
    <Head>
      <title>Train Time</title>
      <link rel="icon" href="/favicon.ico" />
    </Head>
    <Landing />
  </>
)

export default App;
