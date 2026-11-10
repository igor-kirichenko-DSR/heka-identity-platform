const React = require('react')
const { View } = require('react-native')

// Metro turns an .svg import into a component; Jest would give a file path, so render an empty view instead.
const SvgStub = (props) => React.createElement(View, props)

module.exports = { __esModule: true, default: SvgStub }
