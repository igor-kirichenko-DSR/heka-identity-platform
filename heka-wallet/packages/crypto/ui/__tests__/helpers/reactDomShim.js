// mobx-react-lite's CommonJS build batches through react-dom; under Jest it gets React Native's batching instead.
module.exports = { unstable_batchedUpdates: require('react-native').unstable_batchedUpdates }
