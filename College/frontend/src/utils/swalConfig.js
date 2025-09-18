import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

export { MySwal }; // Added export for MySwal

export const showErrorToast = (title, text) => {
  MySwal.fire({
    icon: 'error',
    title,
    text,
    timer: 3000,
    showConfirmButton: false,
    toast: true,
    position: 'top-end',
    customClass: { popup: 'swal-toast' },
  });
};

export const showSuccessToast = (text) => {
  MySwal.fire({
    icon: 'success',
    title: 'Success',
    text,
    timer: 3000,
    showConfirmButton: false,
    toast: true,
    position: 'top-end',
    customClass: { popup: 'swal-toast' },
  });
};

export const showInfoToast = (title, text) => {
  MySwal.fire({
    icon: 'info',
    title,
    text,
    timer: 3000,
    showConfirmButton: false,
    toast: true,
    position: 'top-end',
    customClass: { popup: 'swal-toast' },
  });
};

export const showConfirmToast = (title, text, icon, confirmButtonText, cancelButtonText) => {
  return MySwal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    toast: true,
    position: 'top-end',
    customClass: { popup: 'swal-toast' },
    timer: 5000,
    timerProgressBar: true,
  });
};