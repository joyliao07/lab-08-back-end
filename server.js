'use strict';

const express = require('express');
const superagent = require('superagent');
const cors = require('cors');
const app = express();
const pg = require('pg');

require('dotenv').config();
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();

client.on('error', err => console.error(err));

app.use(cors());
const PORT = process.env.PORT || 3000;

//API routes
app.get('/location', (request, response) => {
  searchToLatLong(request.query.data)
    .then(location => response.send(location));
});

app.get('/weather', getWeather);
app.get('/yelp', getYelp);
app.get('/movies', getMovies);


function searchToLatLong(query){
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GOOGLE_API_KEY}`;
  return superagent.get(url)
    .then(result => {
      return{
        search_query: query,
        formatted_query: result.body.results[0].formatted_address,
        latitude: result.body.results[0].geometry.location.lat,
        longitude: result.body.results[0].geometry.location.lng
      };

    });
}


function getWeather(request, response){
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;
  return superagent
    .get(url)
    .then(result =>{
      let weatherSummaries = result.body.daily.data.map(day => {return new Weather(day);});
      response.send(weatherSummaries);
    });
}
function Weather(day){
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
  this.forecast = day.summary;
}


function getYelp(request, response){
  const url = `https://api.yelp.com/v3/businesses/search?location=${request.query.data.search_query}`;
  superagent
    .get(url)
    .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .then(result =>{
      let yelpSummaries = result.body.businesses.map(restaurant => {return new Business(restaurant);});
      response.send(yelpSummaries);
    });
}
function Business(result){
  this.name = result.name;
  this.image_url = result.image_url;
  this.price = result.price;
  this.rating = result.rating;
  this.url = result.url;
}


function getMovies(request, response){
  const url = `https://api.themoviedb.org/3/search/movie/?api_key=${process.env.MOVIE_API_KEY}&query=${request.query.data.search_query}`;
  superagent
    .get(url)
    .then(result => {
      let movieSummaries = result.body.results.map(selection => {return new Movie(selection);});
      response.send(movieSummaries);
    });
}
function Movie(selection){
  this.title = selection.title;
  this.released_date = selection.release_date;
  this.vote_total = selection.vote_count;
  this.vote_average = selection.vote_average;
  this.popularity = selection.popularity;
  this.image_url = `https://image.tmdb.org/t/p/w500${selection.poster_path}`;
  this.overview = selection.overview;
}





app.listen(PORT, () => console.log(`Listening on ${PORT}`));





















