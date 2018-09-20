'use strict';

const express = require('express');
const superagent = require('superagent');
const cors = require('cors');
const pg = require('pg');

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();

client.on('error', err => console.error(err));

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());


//API routes
// app.get('/location', (request, response) => {
//   searchToLatLong(request.query.data)
//     .then(location => response.send(location));
// });   this was our original code
app.get('/location', getLocation);
app.get('/weather', getWeather);
app.get('/yelp', getYelp);
app.get('/movies', getMovies);

app.listen(PORT, () => console.log(`Listening on ${PORT}`));


function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

function deleteByLocationId(table, city) {
  const SQL = `DELETE from ${table} WHERE location_id=${city};`;
  return client.query(SQL);
}

function Location(query, res){
  this.search_query = query;
  this.formatted_query = res.body.results[0].formatted_address;
  this.latitude = res.body.results[0].geometry.location.lat;
  this.longitude = res.body.results[0].geometry.location.lng;
  this.created_at = Date.now();
}


Location.lookupLocation = (location) => {
  const SQL = 'SELECT * FROM locations WHERE search_query=$1;';
  const values = [location.query];

  return client.query(SQL, values)
    .then(result => {

      if(result.rowCount > 0) {
        location.cacheHit(result.rows[0]);
      } else{
        location.cacheMiss();
      }
    })
    .catch(console.error);
};

// function searchToLatLong(query){   ////////////code from lab-07
//   const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GOOGLE_API_KEY}`;
//   return superagent.get(url)
//     .then(result => {
//       return{
//         search_query: query,
//         formatted_query: result.body.results[0].formatted_address,
//         latitude: result.body.results[0].geometry.location.lat,
//         longitude: result.body.results[0].geometry.location.lng
//       };

//     });
// }

Location.prototype = {
  save: function () {
    const SQL = 'INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id;';
    const values = [this.search_query, this.formatted_query, this.latitude, this.longitude];

    return client.query(SQL, values)
      .then(result => {
        this.id = result.rows[0].id;
        return this;
      });
  }
};

// function Weather(day){   /////old code from lab-07
//   this.time = new Date(day.time * 1000).toString().slice(0, 15);
//   this.forecast = day.summary;
// }

function Weather(day){
  this.tableName = 'weathers';
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
  this.created_at = Date.now();
}

Weather.prototype = {
  save: function (location_id ) {
    const SQL = 'INSERT INTO ${this.tableName} (forecast, time, location_id) VALUES ($1, $2, $3, $4);';
    const values = [this.forecast, this.time, this.created_at, location_id];

    client.query(SQL, values);
  }
};

Weather.tableName = 'weathers';

Weather.lookup = (options) => { ///this need to be refactored
  const SQL = 'SELECT * FROM ${options.tableName} WHERE search_query=$1;';
  const values = [location.query];

  client.query(SQL, values)
    .then(result => {

      if(result.rowCount > 0) {
        options.cacheHit(result.rows);
      } else{
        options.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};

function getLocation(request, response){
  Location.lookupLocation( {
    tableName: Location.tableName,
    query: request.query.data,
    cacheHit: function (result) {
      response.send(result);
    },
    cacheMiss: function () {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${this.query}&key=${process.env.GEOCODE_API_KEY}`;

      return superagent.get(url)
        .then(result => {
          const location = new Location(this.query, result);
          location.save()
            .then(location => response.send(location));
        })
        .catch(error => handleError(error));
    }
  });
}

function getWeather(request, response) {
  Weather.lookup({
    tableName: Weather.tableName,

    cacheMiss: function() {
      const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

      superagent.get(url)
        .then(result => {
          const weatherSummaries = result.body.daily.data.map(day => {
            const summary = new Weather(day);
            summary.save(request.query.data.id);
            return summary;
          });

          response.send(weatherSummaries);
        })
        .catch(error => handleError(error, response));
    },


    cacheHit: function(resultsArray) {
      // Date.now() returns a number in milliseconds since January 1, 1970
      // Subtraction will determine how many milliseconds have elapsed since the instance was created
      // Dividing by 1000 converts the time in milliseconds to a time in seconds
      // Adding 60 to the demonimator (second part of the fraction) will convert seconds to minutes because there are 60 seconds in a minute
      let ageOfResultsInMinutes = ( Date.now() - resultsArray[0].created_at) / (1000 * 60);

      // If the results are older than 30 minutes, nuke them from the database, then request fresh data from the API
      if(ageOfResultsInMinutes > 30) {
        Weather.deleteByLocationId(Weather.tableName, request.query.data.id);
        this.cacheMiss();
      } else {
        // If the results are less than 30 minutes old, send them to the client
        response.send(resultsArray);
      }
    }
  });
}









// function getWeather(request, response){   //////////// old code from lab-07
//   const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;
//   return superagent
//     .get(url)
//     .then(result =>{
//       let weatherSummaries = result.body.daily.data.map(day => {return new Weather(day);});
//       response.send(weatherSummaries);
//     });
// }


// function getYelp(request, response){         //////////// old code from lab-07
//   const url = `https://api.yelp.com/v3/businesses/search?location=${request.query.data.search_query}`;
//   superagent
//     .get(url)
//     .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
//     .then(result =>{
//       let yelpSummaries = result.body.businesses.map(restaurant => {return new Business(restaurant);});
//       response.send(yelpSummaries);
//     });
// }
// function Business(result){
//   this.name = result.name;
//   this.image_url = result.image_url;
//   this.price = result.price;
//   this.rating = result.rating;
//   this.url = result.url;
// }


// function getMovies(request, response){         //////////// old code from lab-07
//   const url = `https://api.themoviedb.org/3/search/movie/?api_key=${process.env.MOVIE_API_KEY}&language=en-US&page=1&query=${request.query.data.search_query}`;
//   superagent
//     .get(url)
//     .then(result => {
//       let movieSummaries = result.body.results.map(selection => {return new Movie(selection);});
//       response.send(movieSummaries);
//     });
// }
// function Movie(selection){
//   this.title = selection.title;
//   this.released_date = selection.release_date;
//   this.vote_total = selection.vote_count;
//   this.vote_average = selection.vote_average;
//   this.popularity = selection.popularity;
//   this.image_url = selection.poster_path;
//   this.overview = selection.overview;
// }



// app.listen(PORT, () => console.log(`Listening on ${PORT}`));





















