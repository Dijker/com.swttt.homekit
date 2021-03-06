const Accessory                 = require('hap-nodejs').Accessory;
const Service                   = require('hap-nodejs').Service;
const Characteristic            = require('hap-nodejs').Characteristic;
const uuid                      = require('hap-nodejs').uuid;
const debounce                  = require('lodash.debounce');
const { returnCapabilityValue } = require('./utils');

module.exports = function(device, api, capabilities) {
  // Init device
  var homekitAccessory = new Accessory(device.name, device.id);

  // Set device info
  homekitAccessory
    .getService(Service.AccessoryInformation)
    .setCharacteristic(Characteristic.Manufacturer, device.driverUri.owner_name)
    .setCharacteristic(Characteristic.Model, device.name + '(' + device.zone.name + ')')
    .setCharacteristic(Characteristic.SerialNumber, device.id);

  // Device identify when added
  homekitAccessory.on('identify', function(paired, callback) {
    console.log(device.name + ' identify');
    callback();
  });

  // Create a new outlet service.
  const outlet = homekitAccessory.addService(Service.Outlet, device.name);

  // Dimmable socket?
  if ('dim' in capabilities) {
    outlet.addCharacteristic(Characteristic.Brightness);
  }

  // Add services and characteristics
  // Onoff
  outlet
    .getCharacteristic(Characteristic.On)
    .on('set', function(value, callback) {
      device.setCapabilityValue('onoff', value)
      callback();
    })
    .on('get', returnCapabilityValue(device, 'onoff'));

  // OutletInUse
  outlet
    .getCharacteristic(Characteristic.OutletInUse)
    .on('get', function(callback) {
      callback(null, true);
    });

  // Brightness
  if ('dim' in capabilities) {
    outlet
      .getCharacteristic(Characteristic.Brightness)
      .on('set', function(value, callback) {
        device.setCapabilityValue('dim', value / 100)
        callback();
      })
      .on('get', returnCapabilityValue(device, 'dim', v => v * 100));
  }

  // On realtime event update the device
  for (let i in device.capabilities) {
    if (['onoff','dim'].includes(device.capabilities[i].split('.')[0])) {
      console.log('created listener for - ' + device.capabilities[i]);
      let listener = async (value) => {
        onStateChange(device.capabilities[i], value, device);
      };
      device.makeCapabilityInstance(device.capabilities[i], listener);
    }
  }

  async function onStateChange(capability, value, device) {

    console.log('State Change - ' + device.name + ' - ' + capability + ' - ' + value);

    const outlet = homekitAccessory.getService(Service.Outlet);

    if (capability == 'onoff') {
      outlet.getCharacteristic(Characteristic.On).updateValue(value);
    } else if (capability == 'dim') {
      outlet.getCharacteristic(Characteristic.Brightness).updateValue(value * 100);
    }
  }

  // Return device to app.js
  return homekitAccessory;
}
