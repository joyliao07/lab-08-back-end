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
// app.get('/location', (request, response) => {
//   searchToLatLong(request.query.data)
//     .then(location => response.send(location))
//     .catch(error => handleError(error, response));
// });


app.get('/location', getLocation);
app.get('/weather', getWeather);
app.get('/yelp', getYelp);
app.get('/movies', getMovies);
app.get('/meetups', getMeetup);
app.get('/trails', getTrails);

Location.lookup = lookup;
Weather.lookup = lookup;
Business.lookup = lookup;
Movie.lookup = lookup;
Meetup.lookup = lookup;
Trails.lookup = lookup;

Location.deleteByLocationId = deleteByLocationId;
Weather.deleteByLocationId = deleteByLocationId;
Business.deleteByLocationId = deleteByLocationId;
Movie.deleteByLocationId = deleteByLocationId;
Meetup.deleteByLocationId = deleteByLocationId;
Trails.deleteByLocationId = deleteByLocationId;

Location.tableName = 'locations';
Weather.tableName = 'weathers';
Business.tableName = 'yelps';
Movie.tableName = 'movies';
Meetup.tableName = 'meetups';
Trails.tableName = 'trails';

// function searchToLatLong(query){
//   const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GOOGLE_API_KEY}`;
//   return superagent.get(url)
//     .then(result => {
//       return{
//         search_query: query,
//         formatted_query: result.body.results[0].formatted_address,
//         latitude: result.body.results[0].geometry.location.lat,
//         longitude: result.body.results[0].geometry.location.lng
//       };
//     })
//     .catch(error => handleError(error));
// }

function getLocation (request, response){
  Location.lookupLocation({
    tableName: Location.tableName,
    query: request.query.data,

    cacheHit: function (result) {
      response.send(result);
    },

    cacheMiss: function () {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${this.query}&key=${process.env.GOOGLE_API_KEY}`;
      return superagent.get(url)
        .then (result => {
          const location = new Location(this.query, result);
          location.save()
            .then(location => response.send(location));
        })
        .catch(error => handleError(error));
    }
  });
}

// function getWeather(request, response){
//   const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;
//   return superagent
//     .get(url)
//     .then(result =>{
//       let weatherSummaries = result.body.daily.data.map(day => {return new Weather(day);});
//       response.send(weatherSummaries);
//     })
//     .catch(error => handleError(error, response));
// }

// function Weather(day){
//   this.time = new Date(day.time * 1000).toString().slice(0, 15);
//   this.forecast = day.summary;
// }

function getWeather (request, response) {
  Weather.lookup({
    tableName: Weather.tableName,
    cacheMiss: function () {
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
    cacheHit: function(resultsArray){
      let ageOfResultsInMinutes = (Date.now()-resultsArray[0].created_at)/(1000*60);
      if(ageOfResultsInMinutes > 30) {
        Weather.deleteByLocationId(Weather.tableName, request.query.data.id);
        this.cacheMiss();
      } else {
        response.send(resultsArray);
      }
    }
  });
}

function Weather (day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
  this.created_at = Date.now();
}

Weather.prototype = {
  save: function(location_id){
    const SQL = `INSERT INTO ${this.tableName} (forecast, time, created_at, location_id) VALUES ($1, $2, $3, $4);`;
    const values = [this.forecast, this.time, this.created_at, location_id];
    client.query(SQL, values);
  }
};

// function getYelp(request, response){
//   const url = `https://api.yelp.com/v3/businesses/search?location=${request.query.data.search_query}`;
//   superagent
//     .get(url)
//     .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
//     .then(result =>{
//       let yelpSummaries = result.body.businesses.map(restaurant => {return new Business(restaurant);});
//       response.send(yelpSummaries);
//     })
//     .catch(error => handleError(error, response));
// }

// function Business(result){
//   this.name = result.name;
//   this.image_url = result.image_url;
//   this.price = result.price;
//   this.rating = result.rating;
//   this.url = result.url;
// }

function getYelp (request, response) {
  Business.lookup({
    tableName: Business.tableName,
    cacheMiss: function () {
      const url = `https://api.yelp.com/v3/businesses/search?location=${request.query.data.search_query}`;

      superagent.get(url)
        .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
        .then(result => {
          const yelpSummaries = result.body.businesses.map(food => {
            let summary = new Business(food);
            summary.save(request.query.data.id);
            return summary;
          });
          response.send(yelpSummaries);
        })
        .catch(error => handleError(error, response));
    },
    cacheHit: function(resultsArray){
      let ageOfResultsInMinutes = (Date.now()-resultsArray[0].created_at)/(1000*60);
      if(ageOfResultsInMinutes > 43200) {
        Business.deleteByLocationId(Business.tableName, request.query.data.id);
        this.cacheMiss();
      } else {
        response.send(resultsArray);
      }
    }
  });
}

function Business (food) {
  this.name = food.name;
  this.image_url = food.image_url;
  this.price = food.price;
  this.rating = food.rating;
  this.url = food.url;
  this.created_at = Date.now();
}

Business.prototype = {
  save: function(location_id){
    const SQL = `INSERT INTO ${this.tableName} (name, image_url, price, rating, url, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7);`;
    const values = [this.name, this.image_url, this.price, this.rating, this.url, this.created_at, location_id];
    client.query(SQL, values);
  }
};

// function getMovies(request, response){
//   const url = `https://api.themoviedb.org/3/search/movie/?api_key=${process.env.MOVIE_API_KEY}&query=${request.query.data.search_query}`;
//   superagent
//     .get(url)
//     .then(result => {
//       let movieSummaries = result.body.results.map(selection => {return new Movie(selection);});
//       response.send(movieSummaries);
//     })
//     .catch(error => handleError(error, response));
// }


// function Movie(selection){
//   this.title = selection.title;
//   this.released_date = selection.release_date;
//   this.vote_total = selection.vote_count;
//   this.vote_average = selection.vote_average;
//   this.popularity = selection.popularity;
//   this.image_url = `https://image.tmdb.org/t/p/w500${selection.poster_path}`;
//   this.overview = selection.overview;
// }

function getMovies (request, response) {
  Movie.lookup({
    tableName: Movie.tableName,
    cacheMiss: function () {
      const url = `https://api.themoviedb.org/3/search/movie/?api_key=${process.env.MOVIE_API_KEY}&query=${request.query.data.search_query}`;

      superagent.get(url)
        .then(result => {
          const movieSummaries = result.body.results.map( movie => {
            let summary = new Movie(movie);
            summary.save(request.query.data.id);
            return summary;
          });
          response.send(movieSummaries);
        })
        .catch(error => handleError(error, response));
    },
    cacheHit: function(resultsArray){
      let ageOfResultsInMinutes = (Date.now()-resultsArray[0].created_at)/(1000*60);
      if(ageOfResultsInMinutes > 43200) {
        Movie.deleteByLocationId(Movie.tableName, request.query.data.id);
        this.cacheMiss();
      } else {
        response.send(resultsArray);
      }
    }
  });
}

function Movie (see) {
  this.title = see.title;
  this.overview = see.overview;
  this.average_votes = see.vote_average;
  this.total_votes = see.vote_count;
  this.image_url = `https://image.tmdb.org/t/p/w500${see.poster_path}`;
  this.popularity = see.popularity;
  this.released_on = see.release_date;
  this.created_at = Date.now();
}

Movie.prototype = {
  save: function(location_id) {
    const SQL = `INSERT INTO ${this.tableName} (title, overview, average_votes, total_votes, image_url, popularity, released_on, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`;
    const values = [this.title, this.overview, this.average_votes, this.total_votes, this.image_url, this.popularity, this.released_on, this.created_at, location_id];
    client.query(SQL, values);
  }
};


// function getMeetup(request, response) {
//   const url = `https://api.meetup.com/find/upcoming_events?photo-host=public&page=20&sign=true&lon=${request.query.data.longitude}&lat=${request.query.data.latitude}&key=${process.env.MEETUP_API_KEY}`;
//   superagent.get(url)
//     .then(result => {
//       let meetupSummaries = result.body.events.map(selection => {return new Meetup(selection);});
//       response.send(meetupSummaries);
//     })
//     .catch(error => handleError(error, response));
// }

// function Meetup(result) {
//   this.link = result.link;
//   this.name = result.name;
//   this.creation_date = new Date(result.created * 1000).toString().slice(0, 15);
//   this.host = result.group.name;
// }

function getMeetup (request, response) {
  Meetup.lookup({
    tableName: Meetup.tableName,
    cacheMiss: function () {
      const url = `https://api.meetup.com/find/upcoming_events?photo-host=public&page=20&sign=true&lon=${request.query.data.longitude}&lat=${request.query.data.latitude}&key=${process.env.MEETUP_API_KEY}`;

      superagent.get(url)
        .then(result => {
          let meetupSummaries = result.body.events.map( meetup => {
            let summary = new Meetup(meetup);
            summary.save(request.query.data.id);
            return summary;
          });
          response.send(meetupSummaries);
        })
        .catch(error => handleError(error, response));
    },
    cacheHit: function(resultsArray){
      let ageOfResultsInMinutes = (Date.now()-resultsArray[0].created_at)/(1000*60);
      if(ageOfResultsInMinutes > 43200) {
        Meetup.deleteByLocationId(Meetup.tableName, request.query.data.id);
        this.cacheMiss();
      } else {
        response.send(resultsArray);
      }
    }
  });
}

function Meetup (result) {
  this.link = result.link;
  this.name = result.name;
  this.creation_date = new Date(result.created * 1000).toString().slice(0, 15);
  this.host = result.group.name;
  this.created_at = Date.now();
}

Meetup.prototype = {
  save: function(location_id) {
    const SQL = `INSERT INTO ${this.tableName} (link, name, creation_date, host, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6);`;
    const values = [this.link, this.name, this.creation_date, this.host, this.created_at, location_id];
    client.query(SQL, values);
  }
};

// function getTrails(request, response) {
//   const url = `https://www.hikingproject.com/data/get-trails?lat=${request.query.data.latitude}&lon=${request.query.data.longitude}&maxDistance=10&key=${process.env.HIKING_API_KEY}`;

//   superagent.get(url)
//     .then(result => {
//       let trailsSummaries = result.body.trails.map(selection => {return new Trails(selection);});
//       response.send(trailsSummaries);
//     })
//     .catch(error => handleError(error, response));
// }

// function Trails(result) {
//   this.name = result.name;
//   this.location = result.location;
//   this.stars = result.stars;
//   this.star_votes = result.starVotes;
//   this.summary = result.summary;
//   this.trail_url = result.url;
//   this.conditions = result.conditionStatus;
//   this.condition_date = result.conditionDate.substring(0, 10);
//   this.condition_time = result.conditionDate.substring(11, 20);
// }

function getTrails (request, response) {
  Trails.lookup({
    tableName: Trails.tableName,
    cacheMiss: function () {
      const url = `https://www.hikingproject.com/data/get-trails?lat=${request.query.data.latitude}&lon=${request.query.data.longitude}&maxDistance=10&key=${process.env.HIKING_API_KEY}`;

      superagent.get(url)
        .then(result => {
          let trailSummaries = result.body.trails.map( trails => {
            let summary = new Trails(trails);
            summary.save(request.query.data.id);
            return summary;
          });
          response.send(trailSummaries);
        })
        .catch(error => handleError(error, response));
    },
    cacheHit: function(resultsArray){
      let ageOfResultsInMinutes = (Date.now()-resultsArray[0].created_at)/(1000*60);
      if(ageOfResultsInMinutes > 43200) {
        Trails.deleteByLocationId(Trails.tableName, request.query.data.id);
        this.cacheMiss();
      } else {
        response.send(resultsArray);
      }
    }
  });
}

function Trails (result) {
  this.name = result.name;
  this.location = result.location;
  this.stars = result.stars;
  this.star_votes = result.starVotes;
  this.summary = result.summary;
  this.trail_url = result.url;
  this.conditions = result.conditionStatus;
  this.condition_date = result.conditionDate.substring(0, 10);
  this.condition_time = result.conditionDate.substring(11, 20);
  this.created_at = Date.now();
}

Trails.prototype = {
  save: function(location_id) {
    const SQL = `INSERT INTO ${this.tableName} (name, location, stars, star_votes, summary, trail_url, conditions, condition_date, condition_time, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`;
    const values = [this.name, this.location, this.stars, this.star_votes, this.summary, this.trail_url, this.conditions, this.condition_date, this.condition_time, this.created_at, location_id];
    client.query(SQL, values);
  }
};



function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

function deleteByLocationId(table, city) {
  const SQL = `DELETE from ${table} WHERE location_id=${city};`;
  return client.query(SQL);
}

function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.body.results[0].formatted_address;
  this.latitude = res.body.results[0].geometry.location.lat;
  this.longitude = res.body.results[0].geometry.location.lng;
  this.created_at = Date.now();
}

function lookup (options) {
  const SQL = `SELECT * FROM ${options.tableName} WHERE location_id=$1;`;
  const values = [options.location];

  client.query(SQL, values)
    .then(result => {
      if(result.rowCount > 0) {
        options.cacheHit(result.rows);
      } else {
        options.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

Location.prototype = {
  save: function() {
    const SQL = 'INSERT INTO locations (search_query, formatted_query, latitude, longitude, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id;';
    const values = [this.search_query, this.formatted_query, this.latitude, this.longitude, this.created_at];

    return client.query(SQL, values)
      .then(result => {
        this.id = result.rows[0].id;
        return this;
      });
  }
};


Location.lookupLocation = (location) => {
  const SQL = 'SELECT * FROM locations WHERE search_query=$1;';
  const values = [location.query];

  return client.query(SQL, values)
    .then(result => {
      if (result.rowCount > 0){
        location.cacheHit(result.rows[0]);
      } else {
        location.cacheMiss();
      }
    })
    .catch(console.error);
};

app.listen(PORT, () => console.log(`Listening on ${PORT}`));





















