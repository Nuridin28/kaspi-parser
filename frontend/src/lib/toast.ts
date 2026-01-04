export const showSuccess = (message: string) => {
  if (typeof window !== 'undefined' && (window as any).toast) {
    (window as any).toast.success(message)
  } else {
    console.log('Success:', message)
  }
}

export const showError = (message: string) => {
  if (typeof window !== 'undefined' && (window as any).toast) {
    (window as any).toast.error(message)
  } else {
    console.error('Error:', message)
    alert(message)
  }
}

export const showInfo = (message: string) => {
  if (typeof window !== 'undefined' && (window as any).toast) {
    (window as any).toast.info(message)
  } else {
    console.log('Info:', message)
  }
}

