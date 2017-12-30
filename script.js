import SS from './style.css';

let G={};

const ALERTS_URL = (coords) => 'https://api.weather.gov/alerts?active=1&point='+coords;
const FORECAST_URL = (coords) => 'https://api.weather.gov/points/'+coords+'/forecast';
const FETCH_TIMEOUT = 5000; //ms
const parseForecast = (f) => f.split('.').filter(e=>!e.match(/wind/gi)).join('.');
const fmtWind = (w) => w.split('to').map(e=>e.trim()).join('-');
const showLoader = () => document.querySelector('div.loader').style.display='inline';
const clearForecast = () => document.querySelector('div.forecast').innerHTML=`<div class="loader"></div>`;
const hideLoader = () => document.querySelector('div.loader').style.display='none';
const fTC = (F) => ((F-32)*5/9).toFixed(1);

function populateSelector(e) {
  let data;
  if (!e) { data=D['NM_WP17(Small).gpx']; }
  else {
    switch (e.target.id) {
      case 'NM': data=D['NM_WP17(Small).gpx']; break;
      case 'CO': data=D['CO_CDT_2017_WP.gpx']; break;
      case 'WY': data=D['WY_CDT_2017_WP.gpx']; break;
      case 'IDMT': data=D['MT_South_WP_16.gpx'].concat(D['MT_North_WP_16.gpx']); break;
      default: break;
    }
    document.querySelectorAll('button.state').forEach(b=>b.classList.remove('selected'));
    e.target.classList.add('selected');
  }
  let sel=document.querySelector('select#loc');
  sel.innerHTML=null;
  data.forEach(pt=>{
    let opt=document.createElement('option');
    opt.value=pt.lat+","+pt.lon;
    opt.innerHTML=pt.name+" "+pt.cmt;
    sel.appendChild(opt);
  });
}

function timeoutPromise(timeout, err, promise) {
  return new Promise(function(resolve,reject) {
    promise.then(resolve,reject);
    setTimeout(reject.bind(null,err), timeout);
  });
}

function fetchForecast(coords) {
  return new Promise(function(resolve,reject) {
    fetch(FORECAST_URL(coords))
    .then(q=>q.status&&q.status!==200 ? reject({err:'forecast'}) : resolve(q.json()))
    .catch(err=>reject({err:'forecast',eObj:err}));
  });
}

function fetchAlerts(coords) {
  return new Promise(function(resolve,reject) {
    fetch(ALERTS_URL(coords)).then(res=>res.json())
    .then(q=>(q.status>=400 && q.status < 600) ? reject({err:'alerts'}) : resolve(q))
    .catch(err=>reject({err:'alerts',eObj:err}));
  });
}

function parseDate(d) {
  d=d.split('T');
  d[0]=d[0].split('-').filter((e,idx)=>idx!==0).join('/');
  return {day:d[0],time:d[1].split('-')[0].split(":").slice(0,2).join(":")};
}

function fmtDates(a, b) {
  a=parseDate(a);
  b=parseDate(b);
  return a.day;
}

function displayError(err) {
  hideLoader();
  let alerts=document.querySelector('div.alerts');
  alerts.style.display='flex';
  let alertHeader=document.createElement('div');
  alertHeader.id='wxAlerts';
  alertHeader.classList.add('alert-header');
  alertHeader.innerHTML=err;
  alerts.appendChild(alertHeader);
}

function showAlerts(a) {
  let alerts=document.querySelector('div.alerts');
  if (a&&a.features&&!a.features.length) { alerts.style.display='none'; }
  else {
    if (a.saved) {
      let M=document.querySelector('div.meta');
      M.style.display='flex';
      let C=document.createElement('div');
      C.id='metaChild';
      C.innerHTML='This is a SAVED offline alert list.';
      M.appendChild(C);
    }
    alerts.innerHTML=null;
    alerts.style.display='flex';
    const numAlerts=a.features.length;
    const aText = numAlerts > 1 ? `${numAlerts} weather alerts` : `${numAlerts} weather alert`;
    let alertHeader=document.createElement('div');
    alertHeader.id='wxAlerts';
    alertHeader.classList.add('alert-header');
    alertHeader.innerHTML=aText;
    alerts.appendChild(alertHeader);
    let alertList=document.createElement('ul');
    a.features.forEach((f,idx)=>{
      const P=f.properties;
      let alert=document.createElement('li');
      alert.id='alert-'+idx;
      alert.classList.add('alert');
      alert.innerHTML=`<p><span id="alertHeadline"><b>${P.severity}</b>: ${P.headline}</span></p><p>${P.description}</p>`;
      alertList.appendChild(alert);
    });
    alerts.appendChild(alertList);
  }
}

function showForecast(f) {
  if (f.saved) {
    let M=document.querySelector('div.meta');
    M.style.display='flex';
    let C=document.createElement('div');
    C.id='metaChild';
    let spl=f.properties.updated.split("T");
    let updDate=spl[0], updTime=spl[1];
    C.innerHTML=`This is a SAVED offline forecast, last updated ${updDate} at ${updTime}.`;
    M.appendChild(C);
  }
  if (!f.properties.periods.length) { return displayError('There was an error fetching the weather forecast.'); }
  let forecast=document.querySelector('div.forecast');
  f.properties.periods.forEach((p,idx)=>{
    let period=document.createElement('div');
    let tempUnits='F';
    let img=G.isOnline ? `<img src=${p.icon} alt=${p.shortForecast}>` : ``;
    period.id='period_'+p.number;
    period.classList.add('forecastPeriod');
    period.innerHTML=`${img}<span id="wxHeader"><b>${p.name} ${idx%2==0 ? fmtDates(p.startTime, p.endTime) : ''}</b><br />
    ${p.temperature}${tempUnits} ${p.temperatureTrend!==null ? p.temperatureTrend : ''} |
    ${fmtWind(p.windSpeed)} ${p.windDirection}</span><br />
    ${parseForecast(p.detailedForecast)}`;
    forecast.appendChild(period);
  });
}

function clearAlertsAndForecast() {
  let meta=document.querySelector('div.meta');
  let alerts=document.querySelector('div.alerts');
  let forecast=document.querySelector('div.forecast');
  alerts.innerHTML='';
  forecast.innerHTML='';
  meta.innerHTML='';
  meta.style.display='none';
}

function saveAlerts(alerts, pos) {
  localStorage.setItem(`alerts_${pos}`, JSON.stringify(Object.assign({},alerts,{saved:true})));
}

function saveForecast(forecast, pos) {
  localStorage.setItem(`forecast_${pos}`, JSON.stringify(Object.assign({},forecast,{saved:true})));
}

function loadAlerts(pos) {
  return new Promise(function(resolve,reject) {
    let loaded=localStorage.getItem(`alerts_${pos}`);
    loaded ? resolve(JSON.parse(loaded)) : reject('There are no offline alerts saved for this location.');
  });
}

function loadForecast(pos) {
  return new Promise(function(resolve,reject) {
    let loaded=localStorage.getItem(`forecast_${pos}`);
    loaded ? resolve(JSON.parse(loaded)) : reject('There is no offline forecast saved for this location.');
  });
}

function handleSubmit(e) {
  const pos=document.querySelector('select#loc').value;
  e.preventDefault();
  clearAlertsAndForecast();
  let A, F;
  if (G.isOnline) {
    A=timeoutPromise(FETCH_TIMEOUT, new Error('Timed Out while fetching weather alerts!'), fetchAlerts(pos))
    F=timeoutPromise(FETCH_TIMEOUT, new Error('Timed Out while fetching weather forecast!'), fetchForecast(pos))
  } else {
    A=loadAlerts(pos);
    F=loadForecast(pos);
  }
  clearForecast();
  showLoader();
  A.then(alerts=>{
    showAlerts(alerts);
    if (!alerts.saved) { saveAlerts(alerts, pos); }
  }).catch(err=>displayError(err));
  F.then(forecast=>{
    showForecast(forecast);
    if (!forecast.saved) { saveForecast(forecast, pos); }
    hideLoader();
  }).catch(err=>displayError(err));
}

const updateIsOnline = (e) => e.type==='offline' ? G.isOnline=false : G.isOnline=true;

function addListeners() {
  G.isOnline=window.navigator.onLine;
  window.addEventListener('online', updateIsOnline);
  window.addEventListener('offline', updateIsOnline);
}

window.onload=function() {
    document.querySelectorAll('button.state').forEach(b=>{ b.addEventListener('click', populateSelector); });
    document.querySelector('button#submit').addEventListener('click', handleSubmit);
    populateSelector();
    addListeners();
}

const D={
  "CO_Alt_WP_2017.gpx":[{"cmt":"Seg 21 Garden Basin TH","name":"CL-061TH","lat":38.751533,"lon":-106.43451699,"ele":-1},{"cmt":"Seg 22 Cottonwood Pass TH","name":"CL-164TH","lat":38.84431698,"lon":-106.44644997,"ele":-1},{"cmt":"Garden Basin TH","name":"ML061TH","lat":38.75153082,"lon":-106.43452303,"ele":3309.214},{"cmt":"Trailhead","name":"ML164TH","lat":38.84431296,"lon":-106.44645299,"ele":3261.665}],
  "CO_CDT_2017_WP.gpx":[{"cmt":"Seg 1 Cumbres Pass TH","name":"01-027TH","lat":37.01801671,"lon":-106.45020003,"ele":3043.123},{"cmt":"Seg 2 Blue WT AP","name":"01-298TH","lat":37.23814996,"lon":-106.62898335,"ele":3498.494},{"cmt":"Seg 3 Elwood Pass TH","name":"02-245TH","lat":37.40554998,"lon":-106.6442333,"ele":3550.31},{"cmt":"Seg 4 Wolf Creek Pass TH","name":"03-176TH","lat":37.48298334,"lon":-106.80223335,"ele":3309.823},{"cmt":"Seg 5 S River Pk AP","name":"04-196AP","lat":37.56658335,"lon":-106.97756667,"ele":3879.19},{"cmt":"Seg 6 Squaw Pass AP","name":"05-237AP","lat":37.60211667,"lon":-107.21686665,"ele":3420.161},{"cmt":"Seg 7 Weminuche Pass AP","name":"06-128AP","lat":37.66508337,"lon":-107.33175002,"ele":3209.544},{"cmt":"Seg 8 Twin Lakes AP","name":"07-106AP","lat":37.64171664,"lon":-107.45681665,"ele":3600.602},{"cmt":"Seg 9 Beartown TH","name":"08-101TH","lat":37.71233333,"lon":-107.51800002,"ele":3599.383},{"cmt":"Seg 10 Stony Pass TH","name":"09-078TH","lat":37.79443332,"lon":-107.54604997,"ele":3818.229},{"cmt":"Seg 11 Carson Saddle TH","name":"10-162TH","lat":37.85609999,"lon":-107.36776664,"ele":3768.547},{"cmt":"Seg 12 Spring Creek Pass TH","name":"11-172TH","lat":37.94015002,"lon":-107.159,"ele":3324.149},{"cmt":"Seg 13 San Luis Pass AP","name":"12-146AP","lat":37.97164997,"lon":-106.9722833,"ele":3639.617},{"cmt":"Seg 14 Eddiesville TH","name":"13-127TH","lat":38.02663333,"lon":-106.83439999,"ele":3147.06},{"cmt":"Seg 15 Saguache Prk Rd AP","name":"14-136TH","lat":38.13149999,"lon":-106.69703334,"ele":2903.83},{"cmt":"Seg 16 CO Hwy 114 TH","name":"15-137TH","lat":38.22291663,"lon":-106.59141666,"ele":2928.214},{"cmt":"Seg 17 Sargents Mesa TH","name":"16-204TH","lat":38.29079999,"lon":-106.37861665,"ele":3541.167},{"cmt":"Seg 18 Marshall Pass TH","name":"17-147TH","lat":38.3917,"lon":-106.24671668,"ele":3310.433},{"cmt":"Seg 19 Monarch Pass TH","name":"18-108TH","lat":38.49620003,"lon":-106.32498337,"ele":3444.24},{"cmt":"Boss Lake Parking","name":"19-109AP","lat":38.56414189,"lon":-106.31459325,"ele":3196.438},{"cmt":"Seg 20 Hancock TH","name":"19-186TH","lat":38.63923335,"lon":-106.36211671,"ele":3367.43},{"cmt":"Begin Seg 21","name":"21-000AP","lat":38.69240597,"lon":-106.4141571,"ele":3374.746},{"cmt":"End Seg 21","name":"21-159TH","lat":38.82782282,"lon":-106.4094634,"ele":3700.882},{"cmt":"Begin Seg 23","name":"23-000AP","lat":38.99858482,"lon":-106.40298109,"ele":3110.179},{"cmt":"Seg 24 Halfmoon Cr TH","name":"23-236TH","lat":39.15161666,"lon":-106.41929998,"ele":3067.812},{"cmt":"Seg 25 Timberline Lk TH","name":"24-131TH","lat":39.28486663,"lon":-106.44715003,"ele":3060.497},{"cmt":"Seg 26 Tenn Pass TH","name":"25-132TH","lat":39.36330004,"lon":-106.31191665,"ele":3177.54},{"cmt":"Seg 27 Copper Mtn AP","name":"26-247AP","lat":39.49250003,"lon":-106.13583332,"ele":2993.136},{"cmt":"Seg 28 Gold Hill TH","name":"27-128TH","lat":39.54121666,"lon":-106.04214996,"ele":2803.55},{"cmt":"Seg 29 Georgia Pass AP","name":"28-200AP","lat":39.46106664,"lon":-105.91034998,"ele":3595.116},{"cmt":"Seg 30 Argentine Pass TH","name":"29-184TH","lat":39.6026167,"lon":-105.81320004,"ele":3323.234},{"cmt":"TH-Follow RD","name":"30-100TH","lat":39.66080002,"lon":-105.7845667,"ele":3428.695},{"cmt":"Seg 31 Herman Gulch TH","name":"30-168TH","lat":39.7024833,"lon":-105.85421671,"ele":3140.05},{"cmt":"Seg 32 Berthoud Pass TH","name":"31-206TH","lat":39.79821671,"lon":-105.77694998,"ele":3444.545},{"cmt":"Seg 33 Rainbow Rd AP","name":"32-095TH","lat":39.8113167,"lon":-105.66734998,"ele":3089.758},{"cmt":"Seg 34 Rollins Pass TH","name":"33-114TH","lat":39.93448332,"lon":-105.68298332,"ele":3560.979},{"cmt":"Indian Pks TH","name":"34-121TH","lat":40.04459998,"lon":-105.73224996,"ele":3068.422},{"cmt":"Seg 35 Monarch Lk TH","name":"34-194TH","lat":40.11135003,"lon":-105.74711669,"ele":2548.433},{"cmt":"Roaring Fork TH","name":"35-018TH","lat":40.12940003,"lon":-105.76404998,"ele":2528.316},{"cmt":"Seg 36 Grand Lake TH","name":"35-143TH","lat":40.24039999,"lon":-105.82575001,"ele":2566.721},{"cmt":"Seg 37 Bowen Gulch TH","name":"36-280TH","lat":40.3282,"lon":-105.85680001,"ele":2673.096},{"cmt":"Seg 38 Willow Creek Pass TH","name":"37-196TH","lat":40.34963337,"lon":-106.08973336,"ele":2920.898},{"cmt":"Begin Seg 38 at Hwy 125","name":"38-000TH","lat":40.34968081,"lon":-106.08996285,"ele":2920.594},{"cmt":"Seg 39 Troublesome Pass AP","name":"38-118AP","lat":40.32790865,"lon":-106.21207637,"ele":3049.524},{"cmt":"Seg 40 FR 104 AP","name":"39-114AP","lat":40.33091666,"lon":-106.31306665,"ele":3499.714},{"cmt":"Begin Seg 41 at Rabbit Ears","name":"40-300TH","lat":40.39979721,"lon":-106.61802334,"ele":2912.059},{"cmt":"Base Camp TH","name":"41-040TH","lat":40.42999998,"lon":-106.65861664,"ele":3056.839},{"cmt":"Seg 42 Buffalo Pass AP","name":"41-154AP","lat":40.54436669,"lon":-106.68496667,"ele":3143.707},{"cmt":"Seg 43 North Lake AP","name":"42-208AP","lat":40.75353331,"lon":-106.73248334,"ele":2582.57},{"cmt":"Fireline Trail FR550","name":"44-031AP","lat":41.01575,"lon":-106.9066333,"ele":2778.557}],
  "MT_North_WP_16.gpx":[{"cmt":"Chief Joseph TH","name":"13-000TH","lat":45.685942,"lon":-113.933353,"ele":-1},{"cmt":"Schultz Saddle AP","name":"13-182AP","lat":45.780658,"lon":-113.787979,"ele":-1},{"cmt":"Johnson Lake AP","name":"14-314AP","lat":45.95741,"lon":-113.488422,"ele":-1},{"cmt":"Seymour TH","name":"15-343TH","lat":45.99118,"lon":-113.183145,"ele":-1},{"cmt":"Access and Parking","name":"16-416AP","lat":45.875713,"lon":-112.720487,"ele":-1},{"cmt":"End Seg 16 at I15","name":"16-439AP","lat":45.871068,"lon":-112.675288,"ele":-1},{"cmt":"Begin Seg 18","name":"17-355AP","lat":45.919295,"lon":-112.411939,"ele":-1},{"cmt":"End Seg 18","name":"18-308AP","lat":46.101635,"lon":-112.414153,"ele":-1},{"cmt":"End Seg 19","name":"19-755AP","lat":46.561454,"lon":-112.308749,"ele":-1},{"cmt":"End Seg 20","name":"20-238AP","lat":46.720453,"lon":-112.466012,"ele":-1},{"cmt":"End Seg 21 at  Stemple Pass","name":"21-198AP","lat":46.893844,"lon":-112.495183,"ele":-1},{"cmt":"Trailhead Parking","name":"22-117AP","lat":46.971058,"lon":-112.359581,"ele":-1},{"cmt":"End Seg 22 Rogers Pass","name":"22-255AP","lat":47.07557,"lon":-112.370988,"ele":-1},{"cmt":"End Seg 23 (Benchmark TH)","name":"23-586TH","lat":47.506522,"lon":-112.891155,"ele":-1},{"cmt":"End Seg 24 Badger Pass","name":"24-843AP","lat":48.133295,"lon":-113.039033,"ele":-1},{"cmt":"End Seg 25 at Marias Pass","name":"25-358TH","lat":48.318996,"lon":-113.352496,"ele":-1},{"cmt":"End Seg 15","name":"26-157AP","lat":48.449186,"lon":-113.235601,"ele":-1},{"cmt":"End Seg 27 at Bridge","name":"27-107TH","lat":48.492126,"lon":-113.365479,"ele":-1},{"cmt":"End Seg 28 at Hwy","name":"28-406TH","lat":48.67807,"lon":-113.653423,"ele":-1},{"cmt":"Swiftcurrent Pass TH","name":"30-012TH","lat":48.797567,"lon":-113.678496,"ele":-1}],
  "NM_Alt_WP2016.gpx":[{"cmt":"","name":"BZ-010TH","lat":34.956209,"lon":-107.943404,"ele":-1},{"cmt":"","name":"CG-0000TH","lat":31.783748,"lon":-107.627834,"ele":-1},{"cmt":"","name":"CW-501TH","lat":34.898793,"lon":-107.858788,"ele":-1},{"cmt":"","name":"GH-000AP","lat":33.220041,"lon":-108.243253,"ele":-1},{"cmt":"","name":"PT-000TH","lat":33.932663,"lon":-108.418897,"ele":-1},{"cmt":"","name":"PT-400AP","lat":34.301755,"lon":-108.138521,"ele":-1}],
  "MT_South_WP_16.gpx":[{"cmt":"Biscuit Basin TH","name":"00-000TH","lat":44.484506,"lon":-110.851046,"ele":-1},{"cmt":"Targhee Pass","name":"01-361TH","lat":44.674246,"lon":-111.273824,"ele":-1},{"cmt":"End Seg 2","name":"02-337TH","lat":44.598476,"lon":-111.520955,"ele":-1},{"cmt":"Access Point","name":"03-114AP","lat":44.554212,"lon":-111.601043,"ele":-1},{"cmt":"End Seg 3","name":"03-306TH","lat":44.508637,"lon":-111.841582,"ele":-1},{"cmt":"End Seg 4","name":"04-318AP","lat":44.520805,"lon":-112.256627,"ele":-1},{"cmt":"Sawmill AP","name":"05-253AP","lat":44.50963,"lon":-112.546947,"ele":-1},{"cmt":"End Seg 5","name":"05-418AP","lat":44.478296,"lon":-112.785839,"ele":-1},{"cmt":"Morrison Lake AP","name":"06-370AP","lat":44.60184,"lon":-113.0339,"ele":-1},{"cmt":"End Seg 7  Bannock Pass","name":"07-249AP","lat":44.814243,"lon":-113.272689,"ele":-1},{"cmt":"End Seg 8 at Lemhi Pass AP","name":"08-271AP","lat":44.974564,"lon":-113.444945,"ele":-1},{"cmt":"End Seg 9","name":"09-195AP","lat":45.143165,"lon":-113.56782,"ele":-1},{"cmt":"End Seg 10","name":"10-242AP","lat":45.292144,"lon":-113.62394,"ele":-1},{"cmt":"End Seg 11","name":"11-359AP","lat":45.549452,"lon":-113.820814,"ele":-1},{"cmt":"Chief Joseph TH","name":"12-166TH","lat":45.685942,"lon":-113.933353,"ele":-1}],
  "WY_CDT_2017_WP.gpx":[{"cmt":"Pipeline Trailhead","name":"01-070AP","lat":41.04136761277914,"lon":-106.92677945829928,"ele":2794.406},{"cmt":"Battle TH","name":"01-212TH","lat":41.15576969459653,"lon":-106.98266554623842,"ele":3023.006},{"cmt":"Deep Jack  AP","name":"02-124AP","lat":41.245102090761065,"lon":-107.11668672971427,"ele":2720.34},{"cmt":"End Seg 2","name":"02-236AP","lat":41.3086508307606,"lon":-107.25636251270771,"ele":2353.97},{"cmt":"Access Point","name":"04-368AP","lat":41.61459758877754,"lon":-107.27869592607021,"ele":2183.892},{"cmt":"End Seg 5","name":"05-188AP","lat":41.82279677130282,"lon":-107.2301403991878,"ele":2095.5},{"cmt":"End Seg 6 at Hwy 63","name":"06-184AP","lat":42.01411044225097,"lon":-107.42935996502638,"ele":1995.83},{"cmt":"AP","name":"07-219AP","lat":42.23264937289059,"lon":-107.70539690740407,"ele":2272.589},{"cmt":"End Seg 8","name":"08-353AP","lat":42.40246673114598,"lon":-108.18262852728367,"ele":2132.99},{"cmt":"End Seg 9","name":"09-257AP","lat":42.39294782280922,"lon":-108.62683419138193,"ele":2200.656},{"cmt":"End Seg 10","name":"10-145AP","lat":42.468727603554726,"lon":-108.80265567451715,"ele":2373.478},{"cmt":"End Seg 11","name":"11-230AP","lat":42.56158039905131,"lon":-109.06042308546603,"ele":2517.343},{"cmt":"Tr to B Sandy","name":"12-225AP","lat":42.695674085989594,"lon":-109.2666795104742,"ele":2777.338},{"cmt":"Big Sandy","name":"12-999TH","lat":42.688316367566586,"lon":-109.27080692723393,"ele":2770.937},{"cmt":"End Seg 13","name":"13-260AP","lat":42.9304033331573,"lon":-109.50966518372297,"ele":2985.516},{"cmt":"End Seg 14","name":"14-267AP","lat":43.137259148061275,"lon":-109.74734670482576,"ele":3151.937},{"cmt":"End Seg 15 Union Pass","name":"15-341AP","lat":43.46907924860716,"lon":-109.88661965355277,"ele":2803.246},{"cmt":"End Seg 16","name":"16-211AP","lat":43.62189659848809,"lon":-110.03500565886497,"ele":2814.219},{"cmt":"End Seg 17","name":"17-194TH","lat":43.75147059559822,"lon":-110.00595440156758,"ele":2767.279},{"cmt":"End Seg 18","name":"18-233AP","lat":43.91244429163635,"lon":-110.20357159897685,"ele":2243.023},{"cmt":"End Seg 19","name":"19-233AP","lat":44.13312907330692,"lon":-110.3003597818315,"ele":2498.446},{"cmt":"End Seg 20","name":"20-271TH","lat":44.31732516735792,"lon":-110.59827852062881,"ele":2373.173},{"cmt":"End Seg 21","name":"21-240AP","lat":44.453640980646014,"lon":-110.82962214946747,"ele":2250.948}],
  "NM_WP17(Small).gpx":[{"cmt":"End Seg 1 at NM81 AP","name":"01-260AP","lat":31.73488201573491,"lon":-108.41136395931244,"ele":1336.548},{"cmt":"End Seg 2 at Hwy 9","name":"02-196AP","lat":31.967424005270004,"lon":-108.43802302144468,"ele":1432.865},{"cmt":"End Seg 3 at NM113 AP","name":"03-128AP","lat":32.08111798390746,"lon":-108.55862704105675,"ele":1362.456},{"cmt":"End Seg 4 at NM 494 (Shakespeare AP)","name":"04-253AP","lat":32.32630700804293,"lon":-108.7250339705497,"ele":1343.558},{"cmt":"End Seg 5 at Burro Peak TH","name":"05-326TH","lat":32.54945296794176,"lon":-108.42774496413767,"ele":1948.891},{"cmt":"End Seg 6 at Silver City AP","name":"06-450AP","lat":32.780877985060215,"lon":-108.28256201930344,"ele":1813.865},{"cmt":"End Seg 7 at Hwy NM15","name":"07-201TH","lat":32.88630899973214,"lon":-108.22700701653957,"ele":2048.865},{"cmt":"End Seg 8 at Hwy NM35 AP","name":"08-218AP","lat":33.01606798544526,"lon":-108.11600295826793,"ele":1883.359},{"cmt":"End Seg 9 at Rocky Point AP on FR150","name":"09-130AP","lat":33.12214097008109,"lon":-108.00700795836747,"ele":2421.636},{"cmt":"End Seg 10 at FR226 AP","name":"10-346AP","lat":33.33557297475636,"lon":-107.8312989603728,"ele":2391.461},{"cmt":"End Seg 11 at US59 TH","name":"11-151TH","lat":33.44490501098335,"lon":-107.87672803737223,"ele":2347.57},{"cmt":"End Seg 12 at NM163 AP","name":"12-255AP","lat":33.68520596064627,"lon":-107.85025304183364,"ele":2318.309},{"cmt":"End Seg 13 at FR28 AP","name":"13-324AP","lat":33.65333897061646,"lon":-108.27631004154682,"ele":2282.038},{"cmt":"End Seg 14 at FR3070 AP","name":"14-274AP","lat":33.74205001629889,"lon":-108.47739801742136,"ele":2752.039},{"cmt":"End Seg 15 at NM 12","name":"15-232TH","lat":33.9326629601419,"lon":-108.4188970271498,"ele":2234.794},{"cmt":"End Seg 16","name":"16-364TH","lat":34.320808025076985,"lon":-108.3553190343082,"ele":2164.994},{"cmt":"End Seg 17","name":"17-422AP","lat":34.60089401341975,"lon":-108.39687198400497,"ele":2284.781},{"cmt":"End Seg 18  at NM 117 AP","name":"18-227AP","lat":34.70283103175461,"lon":-108.02839103154838,"ele":2159.203},{"cmt":"End Seg 19 at Zuni-Acoma TH","name":"19-552TH","lat":34.898846028372645,"lon":-107.85916300490499,"ele":2095.5},{"cmt":"End Seg 20 at Mt. Taylor TH","name":"20-273TH","lat":35.18940696492791,"lon":-107.77231299318373,"ele":2095.195},{"cmt":"End Seg 21 at FR 239 AP","name":"21-264AP","lat":35.34609298221767,"lon":-107.56264303810894,"ele":2499.969},{"cmt":"End Seg 22 at FR239A TH","name":"22-179TH","lat":35.52545598708093,"lon":-107.38274099305272,"ele":2412.492},{"cmt":"End Seg 23 at Cerro Colorado AP","name":"23-298AP","lat":35.74339603073895,"lon":-107.07465299405158,"ele":2004.67},{"cmt":"End Seg 24 at Los Pinos TH","name":"24-355TH","lat":36.10315200872719,"lon":-106.90604598261416,"ele":2494.483},{"cmt":"End Seg 25 at NM 96 AP","name":"25-197AP","lat":36.20346796698868,"lon":-106.7207029927522,"ele":2274.722},{"cmt":"End Seg 26 at Skull Bridge TH","name":"26-143TH","lat":36.330016013234854,"lon":-106.62482801824808,"ele":1931.518},{"cmt":"End Seg 27 at AP near US84","name":"27-144AP","lat":36.39988697133958,"lon":-106.49590001441538,"ele":2098.548},{"cmt":"End Seg 28 at FS559 AP","name":"28-228AP","lat":36.52187601663172,"lon":-106.29488202743232,"ele":2821.838},{"cmt":"End Seg 29 at Hwy 64 AP","name":"29-309AP","lat":36.70991102233529,"lon":-106.23006703332067,"ele":2983.078},{"cmt":"End Seg 30 at Lagunitas CG AP","name":"30-177AP","lat":36.87598703429103,"lon":-106.31931502372026,"ele":3125.724},{"cmt":"Cumbres Pass TH","name":"32-028TH","lat":37.01788200996816,"lon":-106.45007497631013,"ele":3041.294}]
};
