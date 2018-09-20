'use strict';

const express = require('express');
const superagent = require('superagent');
const cors = require('cors');
const app = express();
app.use(cors());
require('dotenv').config();
const PORT = process.env.PORT || 3000;

//API routes
app.get('/location', (request, response) => {
  searchToLatLong(request.query.data)
    .then(location => response.send(location));
});

// Dark Skies / weather
app.get('/weather', getWeather);

app.get('/yelp', getYelp);

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
  return superagent.get(url)
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

  superagent.get(url).set('Authorization', `Bearer ${process.env.YELP_API_KEY}`);

  // .then(result =>{
  // const yelpSummaries = [];

  // result.body.forEach( result => {
  //   const summary = new Yelp(result);
  //   yelpSummaries.push(summary);
  // });
  console.log('Yelp result.body: ', result.body.businesses);
  // response.send(yelpSummaries);
  // });
}


// function Yelp(result){
//   this.name = result.body.businesses.name;
//   this.image_url = result.body.businesses.image_url;
//   this.price = result.body.businesses.price;
//   this.rating = result.body.businesses.rating;
//   this.url = result.body.businesses.url;
// }




app.listen(PORT, () => console.log(`Listening on ${PORT}`));





















