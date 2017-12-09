const path = require('path');
const webpack = require('webpack'); //to access built-in plugins
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {
  entry: {
    app: './script.js'
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, './')
  },
  module: {
  rules: [
    {
      test: /\.js$/,
      exclude: /(node_modules|bower_components)/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['es2015']
        }
      }
    },
    {
      test: /\.css$/,
      use: ExtractTextPlugin.extract({
      fallback: 'style-loader',
      use: [
         { loader: 'css-loader', options: { minimize: true } }
      ]
   })
    }
  ]
},
  plugins: [
    new UglifyJsPlugin({parallel: 4}),
    new ExtractTextPlugin('style.min.css')
 ]
};
